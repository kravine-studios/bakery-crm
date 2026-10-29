import { query, withTransaction } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction, BatchStatus } from '../../types/enums';
import type { PoolClient } from 'pg';
import type { Request } from 'express';

// ─── Batch Number Generator (MM-YY-NNN) ───────────────────

/**
 * Generate the next batch number in MM-YY-NNN format (PRD 5.5).
 * Per product per month, so the same sweet made three times in March
 * has 03-26-001, 03-26-002, 03-26-003.
 */
async function generateBatchNumber(client: PoolClient, productId: number): Promise<string> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const yearMonth = `${mm}-${yy}`;

  const result = await client.query<{ last_seq: string }>(
    `INSERT INTO batch_sequence (product_id, year_month, last_seq)
     VALUES ($1, $2, 1)
     ON CONFLICT (product_id, year_month)
     DO UPDATE SET last_seq = batch_sequence.last_seq + 1
     RETURNING last_seq`,
    [productId, yearMonth]
  );
  const seq = parseInt(result.rows[0].last_seq, 10);
  return `${mm}-${yy}-${String(seq).padStart(3, '0')}`;
}

// ─── Types ────────────────────────────────────────────────

interface MaterialUsageInput {
  rawMaterialId: number;
  lotId?: number;
  plannedQuantity: number;
  actualQuantity: number;
  unit: string;
}

interface CreateBatchParams {
  productId: number;
  recipeId: number;
  plannedQuantity: number;
  unit: string;
  supervisedBy: number;
  shiftId?: number;
  notes?: string;
  // If not provided, materials are loaded from the recipe
  materialUsage?: MaterialUsageInput[];
  createdBy: number;
  req: Request;
}

// ─── Create Production Batch ──────────────────────────────

export async function createBatch(params: CreateBatchParams) {
  return withTransaction(async (client) => {
    // Validate product and recipe exist
    const recipeResult = await client.query(
      `SELECT r.id, r.batch_size, r.batch_unit, p.id AS product_id, p.shelf_life_days
       FROM recipes r JOIN products p ON p.id = r.product_id
       WHERE r.id = $1 AND r.product_id = $2`,
      [params.recipeId, params.productId]
    );
    if (recipeResult.rowCount === 0) throw new ApiError(404, 'Recipe not found for this product');

    const recipe = recipeResult.rows[0];
    const batchNumber = await generateBatchNumber(client, params.productId);

    // Calculate expiry from product shelf life (PRD 5.5)
    let expiryDate: Date | null = null;
    if (recipe.shelf_life_days) {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + recipe.shelf_life_days);
    }

    // Insert batch record
    const batchResult = await client.query<{ id: number }>(
      `INSERT INTO production_batches (batch_number, product_id, recipe_id, planned_quantity,
                                       unit, status, production_date, expiry_date, supervised_by,
                                       shift_id, notes, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING id`,
      [
        batchNumber, params.productId, params.recipeId, params.plannedQuantity,
        params.unit, BatchStatus.InProgress,
        expiryDate ? expiryDate.toISOString().split('T')[0] : null,
        params.supervisedBy, params.shiftId ?? null, params.notes ?? null, params.createdBy,
      ]
    );
    const batchId = batchResult.rows[0].id;

    // Determine material usage: from provided input or from recipe
    let usage: MaterialUsageInput[];
    if (params.materialUsage && params.materialUsage.length > 0) {
      usage = params.materialUsage;
    } else {
      // Load from recipe items, scaled to planned quantity
      const recipeItemsResult = await client.query(
        `SELECT ri.raw_material_id, ri.quantity, ri.unit, r.batch_size
         FROM recipe_items ri JOIN recipes r ON r.id = ri.recipe_id
         WHERE ri.recipe_id = $1`,
        [params.recipeId]
      );
      const scaleFactor = params.plannedQuantity / recipe.batch_size;
      usage = recipeItemsResult.rows.map((ri) => ({
        rawMaterialId: ri.raw_material_id,
        plannedQuantity: ri.quantity * scaleFactor,
        actualQuantity: ri.quantity * scaleFactor, // default: actual = planned
        unit: ri.unit,
      }));
    }

    // Deduct raw materials using FIFO lots (PRD 5.4)
    let totalCost = 0;
    for (const mu of usage) {
      // Find FIFO lots with remaining stock
      const lotsResult = await client.query<{ id: number; rate: string; quantity_remaining: string }>(
        `SELECT id, rate::text, quantity_remaining::text
         FROM raw_material_lots
         WHERE raw_material_id = $1 AND quantity_remaining > 0
         ORDER BY received_date ASC, expiry_date ASC NULLS LAST
         LIMIT 10`,
        [mu.rawMaterialId]
      );

      let qtyToConsume = mu.actualQuantity;
      let lineCost = 0;
      let consumedLotId: number | null = null;

      for (const lot of lotsResult.rows) {
        if (qtyToConsume <= 0) break;
        const available = parseFloat(lot.quantity_remaining);
        const rate = parseFloat(lot.rate);
        const consume = Math.min(qtyToConsume, available);

        await client.query(
          'UPDATE raw_material_lots SET quantity_remaining = quantity_remaining - $1 WHERE id = $2',
          [consume, lot.id]
        );

        // Record raw material movement
        await client.query(
          `INSERT INTO raw_material_movements (raw_material_id, lot_id, movement_type, quantity,
                                               unit, reference_type, reference_id, created_by, created_at)
           VALUES ($1, $2, 'production', $3, $4, 'production_batch', $5, $6, NOW())`,
          [mu.rawMaterialId, lot.id, -consume, mu.unit, batchId, params.createdBy]
        );

        lineCost += consume * rate;
        qtyToConsume -= consume;
        consumedLotId = lot.id;
      }

      if (qtyToConsume > 0.01) {
        throw new ApiError(
          400,
          `Insufficient stock for raw material ID ${mu.rawMaterialId}. Short by ${qtyToConsume.toFixed(3)} ${mu.unit}.`
        );
      }

      // Record batch material usage
      await client.query(
        `INSERT INTO batch_material_usage (batch_id, raw_material_id, lot_id, planned_quantity,
                                           actual_quantity, unit, rate, line_cost, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [batchId, mu.rawMaterialId, consumedLotId, mu.plannedQuantity, mu.actualQuantity,
         mu.unit, lineCost / mu.actualQuantity, lineCost]
      );

      totalCost += lineCost;
    }

    // Update batch with production cost
    await client.query(
      'UPDATE production_batches SET production_cost = $1 WHERE id = $2',
      [totalCost, batchId]
    );

    await auditLog({
      userId: params.createdBy,
      action: AuditAction.Create,
      entity: 'production_batch',
      entityId: batchId,
      after: { batchNumber, plannedQuantity: params.plannedQuantity, productionCost: totalCost },
      req: params.req,
    });

    return { batchId, batchNumber, productionCost: totalCost };
  });
}

// ─── Complete Batch ──────────────────────────────────────

export async function completeBatch(params: {
  batchId: number;
  actualQuantity: number;
  updatedBy: number;
  req: Request;
}) {
  return withTransaction(async (client) => {
    const batchResult = await client.query(
      `SELECT id, product_id, planned_quantity, production_cost, status
       FROM production_batches WHERE id = $1`,
      [params.batchId]
    );
    if (batchResult.rowCount === 0) throw new ApiError(404, 'Batch not found');
    const batch = batchResult.rows[0];
    if (batch.status === BatchStatus.Completed || batch.status === BatchStatus.Closed) {
      throw new ApiError(400, 'Batch already completed');
    }

    const costPerUnit = params.actualQuantity > 0
      ? batch.production_cost / params.actualQuantity
      : 0;

    await client.query(
      `UPDATE production_batches SET actual_quantity = $1, status = $2,
                                     cost_per_unit = $3, completed_date = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [params.actualQuantity, BatchStatus.Completed, costPerUnit, params.batchId]
    );

    // Add finished goods to stock (PRD 5.6)
    await client.query(
      `INSERT INTO stock_movements (product_id, batch_id, movement_type, quantity, unit,
                                   reference_type, reference_id, created_by, created_at)
       VALUES ($1, $2, 'production', $3, $4, 'production_batch', $5, $6, NOW())`,
      [batch.product_id, params.batchId, params.actualQuantity, 'kg', params.batchId, params.updatedBy]
    );

    await auditLog({
      userId: params.updatedBy,
      action: AuditAction.Update,
      entity: 'production_batch',
      entityId: params.batchId,
      after: { actualQuantity: params.actualQuantity, costPerUnit },
      req: params.req,
    });

    return { batchId: params.batchId, actualQuantity: params.actualQuantity, costPerUnit };
  });
}

// ─── List / Get Batches ──────────────────────────────────

export async function listBatches(filters: { status?: BatchStatus; productId?: number; dateFrom?: string; dateTo?: string } = {}) {
  let sql = `SELECT b.id, b.batch_number, b.product_id, p.name AS product_name,
                    b.planned_quantity::text, b.actual_quantity::text, b.unit, b.status,
                    b.production_date, b.completed_date, b.expiry_date,
                    b.production_cost::text, b.cost_per_unit::text,
                    u.display_name AS supervisor_name, b.shift_id, b.notes
             FROM production_batches b
             JOIN products p ON p.id = b.product_id
             JOIN users u ON u.id = b.supervised_by
             WHERE 1=1`;
  const values: unknown[] = [];
  let idx = 1;

  if (filters.status) { sql += ` AND b.status = $${idx++}`; values.push(filters.status); }
  if (filters.productId) { sql += ` AND b.product_id = $${idx++}`; values.push(filters.productId); }
  if (filters.dateFrom) { sql += ` AND b.production_date >= $${idx++}`; values.push(filters.dateFrom); }
  if (filters.dateTo) { sql += ` AND b.production_date <= $${idx++}`; values.push(filters.dateTo + ' 23:59:59'); }

  sql += ` ORDER BY b.production_date DESC`;
  const result = await query(sql, values);
  return result.rows.map((r) => ({
    ...r,
    plannedQuantity: parseFloat(r.planned_quantity),
    actualQuantity: r.actual_quantity ? parseFloat(r.actual_quantity) : null,
    productionCost: parseFloat(r.production_cost),
    costPerUnit: parseFloat(r.cost_per_unit),
  }));
}

export async function getBatchById(id: number) {
  const batchResult = await query(
    `SELECT b.id, b.batch_number, b.product_id, p.name AS product_name,
            b.recipe_id, b.planned_quantity::text, b.actual_quantity::text, b.unit, b.status,
            b.production_date, b.completed_date, b.expiry_date,
            b.production_cost::text, b.cost_per_unit::text,
            u.display_name AS supervisor_name, b.shift_id, b.notes, b.created_at
     FROM production_batches b
     JOIN products p ON p.id = b.product_id
     JOIN users u ON u.id = b.supervised_by
     WHERE b.id = $1`,
    [id]
  );
  if (batchResult.rowCount === 0) throw new ApiError(404, 'Batch not found');

  const batch = batchResult.rows[0];
  const usage = await query(
    `SELECT bmu.id, bmu.raw_material_id, rm.name AS raw_material_name,
            bmu.lot_id, bmu.planned_quantity::text, bmu.actual_quantity::text, bmu.unit,
            bmu.rate::text, bmu.line_cost::text, bmu.variance::text
     FROM batch_material_usage bmu
     JOIN raw_materials rm ON rm.id = bmu.raw_material_id
     WHERE bmu.batch_id = $1`,
    [id]
  );

  return {
    ...batch,
    plannedQuantity: parseFloat(batch.planned_quantity),
    actualQuantity: batch.actual_quantity ? parseFloat(batch.actual_quantity) : null,
    productionCost: parseFloat(batch.production_cost),
    costPerUnit: parseFloat(batch.cost_per_unit),
    materialUsage: usage.rows.map((u) => ({
      ...u,
      plannedQuantity: parseFloat(u.planned_quantity),
      actualQuantity: parseFloat(u.actual_quantity),
      rate: parseFloat(u.rate),
      lineCost: parseFloat(u.line_cost),
      variance: parseFloat(u.variance),
    })),
  };
}

// ─── Traceability (PRD 5.6) ──────────────────────────────

export async function getBatchTraceability(batchId: number) {
  // From a batch, see raw materials used, who supervised, and which bills sold it
  const batch = await getBatchById(batchId);

  const bills = await query(
    `SELECT DISTINCT b.id, b.invoice_number, b.bill_date, b.grand_total::text,
            bi.quantity::text, u.display_name AS cashier_name
     FROM bills b
     JOIN bill_items bi ON bi.bill_id = b.id
     JOIN users u ON u.id = b.cashier_id
     WHERE bi.batch_id = $1 AND b.status != 'cancelled'
     ORDER BY b.bill_date DESC`,
    [batchId]
  );

  return {
    batch,
    soldInBills: bills.rows.map((b) => ({ ...b, grandTotal: parseFloat(b.grand_total), quantity: parseFloat(b.quantity) })),
  };
}
