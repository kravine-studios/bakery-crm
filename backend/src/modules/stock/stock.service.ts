import { query, withTransaction } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction, WastageReason } from '../../types/enums';
import type { Request } from 'express';

// ─── Finished Goods Stock ────────────────────────────────

export async function getFinishedStock(filters: { productId?: number; nearExpiry?: boolean } = {}) {
  let sql = `SELECT p.id AS product_id, p.name AS product_name, b.id AS batch_id,
                    b.batch_number, b.expiry_date, b.production_date,
                    COALESCE(SUM(sm.quantity), 0)::text AS current_stock, p.selling_unit
             FROM products p
             LEFT JOIN production_batches b ON b.product_id = p.id
             LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.batch_id = b.id
             WHERE p.is_active = TRUE`;
  const values: unknown[] = [];
  let idx = 1;

  if (filters.productId) { sql += ` AND p.id = $${idx++}`; values.push(filters.productId); }
  sql += ` GROUP BY p.id, p.name, b.id, b.batch_number, b.expiry_date, b.production_date, p.selling_unit`;
  sql += ` HAVING COALESCE(SUM(sm.quantity), 0) > 0`;

  if (filters.nearExpiry) {
    sql += ` AND b.expiry_date IS NOT NULL AND b.expiry_date <= CURRENT_DATE + 7`;
  }
  sql += ` ORDER BY p.name ASC, b.expiry_date ASC NULLS LAST`;

  const result = await query(sql, values);
  return result.rows.map((r) => ({ ...r, currentStock: parseFloat(r.current_stock) }));
}

export async function getExpiredStock() {
  const result = await query(
    `SELECT p.id AS product_id, p.name AS product_name, b.id AS batch_id, b.batch_number,
            b.expiry_date, COALESCE(SUM(sm.quantity), 0)::text AS current_stock, p.selling_unit
     FROM products p
     JOIN production_batches b ON b.product_id = p.id
     LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.batch_id = b.id
     WHERE b.expiry_date < CURRENT_DATE
     GROUP BY p.id, p.name, b.id, b.batch_number, b.expiry_date, p.selling_unit
     HAVING COALESCE(SUM(sm.quantity), 0) > 0
     ORDER BY b.expiry_date ASC`
  );
  return result.rows.map((r) => ({ ...r, currentStock: parseFloat(r.current_stock) }));
}

export async function getStockMovements(filters: { productId?: number; batchId?: number; type?: string; dateFrom?: string; dateTo?: string; limit?: number } = {}) {
  let sql = `SELECT sm.id, sm.product_id, p.name AS product_name, sm.batch_id, b.batch_number,
                    sm.movement_type, sm.quantity::text, sm.unit, sm.reference_type, sm.reference_id,
                    sm.notes, u.display_name AS created_by_name, sm.created_at
             FROM stock_movements sm
             JOIN products p ON p.id = sm.product_id
             LEFT JOIN production_batches b ON b.id = sm.batch_id
             JOIN users u ON u.id = sm.created_by
             WHERE 1=1`;
  const values: unknown[] = [];
  let idx = 1;

  if (filters.productId) { sql += ` AND sm.product_id = $${idx++}`; values.push(filters.productId); }
  if (filters.batchId) { sql += ` AND sm.batch_id = $${idx++}`; values.push(filters.batchId); }
  if (filters.type) { sql += ` AND sm.movement_type = $${idx++}`; values.push(filters.type); }
  if (filters.dateFrom) { sql += ` AND sm.created_at >= $${idx++}`; values.push(filters.dateFrom); }
  if (filters.dateTo) { sql += ` AND sm.created_at <= $${idx++}`; values.push(filters.dateTo + ' 23:59:59'); }

  sql += ` ORDER BY sm.created_at DESC LIMIT $${idx++}`;
  values.push(filters.limit ?? 100);

  const result = await query(sql, values);
  return result.rows.map((r) => ({ ...r, quantity: parseFloat(r.quantity) }));
}

// ─── Wastage ─────────────────────────────────────────────

export async function recordWastage(params: {
  productId: number;
  batchId?: number;
  quantity: number;
  unit: string;
  reason: WastageReason;
  notes?: string;
  approvedBy: number;
  req: Request;
}) {
  return withTransaction(async (client) => {
    // Get cost value for the wasted quantity
    let costValue = 0;
    if (params.batchId) {
      const costResult = await client.query<{ cost_per_unit: string }>(
        'SELECT cost_per_unit::text FROM production_batches WHERE id = $1',
        [params.batchId]
      );
      if (costResult.rowCount) {
        costValue = parseFloat(costResult.rows[0].cost_per_unit) * params.quantity;
      }
    } else {
      const costResult = await client.query<{ cost_price: string }>(
        'SELECT cost_price::text FROM products WHERE id = $1',
        [params.productId]
      );
      if (costResult.rowCount) {
        costValue = parseFloat(costResult.rows[0].cost_price) * params.quantity;
      }
    }

    const result = await client.query<{ id: number }>(
      `INSERT INTO wastage_records (product_id, batch_id, quantity, unit, cost_value, reason,
                                   notes, approved_by, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, NOW()) RETURNING id`,
      [params.productId, params.batchId ?? null, params.quantity, params.unit, costValue,
       params.reason, params.notes ?? null, params.approvedBy]
    );
    const id = result.rows[0].id;

    // Record stock movement (out)
    await client.query(
      `INSERT INTO stock_movements (product_id, batch_id, movement_type, quantity, unit,
                                   reference_type, reference_id, created_by, created_at)
       VALUES ($1, $2, 'wastage', $3, $4, 'wastage', $5, $6, NOW())`,
      [params.productId, params.batchId ?? null, -params.quantity, params.unit, id, params.approvedBy]
    );

    await auditLog({
      userId: params.approvedBy,
      action: AuditAction.Create,
      entity: 'wastage',
      entityId: id,
      after: { ...params, costValue },
      req: params.req,
    });

    return { wastageId: id, costValue };
  });
}

export async function listWastage(filters: { productId?: number; reason?: string; dateFrom?: string; dateTo?: string } = {}) {
  let sql = `SELECT w.id, w.product_id, p.name AS product_name, w.batch_id, b.batch_number,
                    w.quantity::text, w.unit, w.cost_value::text, w.reason, w.notes,
                    u.display_name AS approved_by_name, w.created_at
             FROM wastage_records w
             JOIN products p ON p.id = w.product_id
             LEFT JOIN production_batches b ON b.id = w.batch_id
             JOIN users u ON u.id = w.approved_by
             WHERE 1=1`;
  const values: unknown[] = [];
  let idx = 1;
  if (filters.productId) { sql += ` AND w.product_id = $${idx++}`; values.push(filters.productId); }
  if (filters.reason) { sql += ` AND w.reason = $${idx++}`; values.push(filters.reason); }
  if (filters.dateFrom) { sql += ` AND w.created_at >= $${idx++}`; values.push(filters.dateFrom); }
  if (filters.dateTo) { sql += ` AND w.created_at <= $${idx++}`; values.push(filters.dateTo + ' 23:59:59'); }
  sql += ` ORDER BY w.created_at DESC`;
  const result = await query(sql, values);
  return result.rows.map((r) => ({ ...r, quantity: parseFloat(r.quantity), costValue: parseFloat(r.cost_value) }));
}

// ─── Stock Adjustment / Stocktake ─────────────────────────

export async function stockAdjustment(params: {
  productId: number; batchId?: number; adjustmentQuantity: number; unit: string;
  reason: string; adjustedBy: number; req: Request;
}) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO stock_movements (product_id, batch_id, movement_type, quantity, unit,
                                     reference_type, notes, created_by, created_at)
       VALUES ($1, $2, 'adjustment', $3, $4, 'stock_adjustment', $5, $6, NOW()) RETURNING id`,
      [params.productId, params.batchId ?? null, params.adjustmentQuantity, params.unit,
       params.reason, params.adjustedBy]
    );
    const movementId = result.rows[0].id;

    await auditLog({
      userId: params.adjustedBy,
      action: AuditAction.Update,
      entity: 'stock_adjustment',
      entityId: movementId,
      after: params,
      req: params.req,
    });

    return { movementId };
  });
}
