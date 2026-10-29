import { query } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction } from '../../types/enums';
import type { Request } from 'express';

export async function listRawMaterials(includeInactive = false) {
  const sql = includeInactive
    ? `SELECT rm.id, rm.name, rm.code, rm.base_unit, rm.min_stock_level::text, rm.shelf_life_days,
              rm.cost_method, rm.is_active, COALESCE(v.current_stock::text, '0') AS current_stock,
              v.earliest_expiry
       FROM raw_materials rm
       LEFT JOIN v_raw_material_stock v ON v.raw_material_id = rm.id
       ORDER BY rm.name ASC`
    : `SELECT rm.id, rm.name, rm.code, rm.base_unit, rm.min_stock_level::text, rm.shelf_life_days,
              rm.cost_method, rm.is_active, COALESCE(v.current_stock::text, '0') AS current_stock,
              v.earliest_expiry
       FROM raw_materials rm
       LEFT JOIN v_raw_material_stock v ON v.raw_material_id = rm.id
       WHERE rm.is_active = TRUE ORDER BY rm.name ASC`;
  const result = await query(sql);
  return result.rows.map((r) => ({
    ...r,
    minStockLevel: parseFloat(r.min_stock_level),
    currentStock: parseFloat(r.current_stock),
  }));
}

export async function getRawMaterialById(id: number) {
  const result = await query(
    `SELECT id, name, code, base_unit, min_stock_level::text, shelf_life_days, cost_method,
            is_active, created_at
     FROM raw_materials WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) throw new ApiError(404, 'Raw material not found');
  return { ...result.rows[0], minStockLevel: parseFloat(result.rows[0].min_stock_level) };
}

export async function createRawMaterial(params: {
  name: string; code?: string; description?: string; baseUnit: string;
  minStockLevel?: number; shelfLifeDays?: number; costMethod?: string;
  createdBy: number; req: Request;
}) {
  const result = await query<{ id: number }>(
    `INSERT INTO raw_materials (name, code, description, base_unit, min_stock_level,
                                shelf_life_days, cost_method, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW()) RETURNING id`,
    [params.name, params.code ?? null, params.description ?? null, params.baseUnit,
     params.minStockLevel ?? 0, params.shelfLifeDays ?? null, params.costMethod ?? 'avg']
  );
  const id = result.rows[0].id;
  await auditLog({ userId: params.createdBy, action: AuditAction.Create, entity: 'raw_material', entityId: id, after: params, req: params.req });
  return getRawMaterialById(id);
}

export async function updateRawMaterial(params: {
  id: number; name?: string; code?: string; baseUnit?: string; minStockLevel?: number;
  shelfLifeDays?: number; costMethod?: string; isActive?: boolean; updatedBy: number; req: Request;
}) {
  const before = await getRawMaterialById(params.id);
  const fields: Record<string, string> = {
    name: 'name', code: 'code', baseUnit: 'base_unit', minStockLevel: 'min_stock_level',
    shelfLifeDays: 'shelf_life_days', costMethod: 'cost_method', isActive: 'is_active',
  };
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const [param, col] of Object.entries(fields)) {
    const val = (params as Record<string, unknown>)[param];
    if (val !== undefined) { updates.push(`${col} = $${idx++}`); values.push(val); }
  }
  if (updates.length === 0) return before;
  values.push(params.id);
  await query(`UPDATE raw_materials SET ${updates.join(', ')} WHERE id = $${idx}`, values);
  const after = await getRawMaterialById(params.id);
  await auditLog({ userId: params.updatedBy, action: AuditAction.Update, entity: 'raw_material', entityId: params.id, before, after, req: params.req });
  return after;
}

export async function getLowStockMaterials() {
  const result = await query(
    `SELECT rm.id, rm.name, rm.base_unit, rm.min_stock_level::text, COALESCE(v.current_stock::text, '0') AS current_stock
     FROM raw_materials rm
     LEFT JOIN v_raw_material_stock v ON v.raw_material_id = rm.id
     WHERE rm.is_active = TRUE AND COALESCE(v.current_stock, 0) < rm.min_stock_level
     ORDER BY rm.name ASC`
  );
  return result.rows.map((r) => ({
    ...r,
    minStockLevel: parseFloat(r.min_stock_level),
    currentStock: parseFloat(r.current_stock),
  }));
}

export async function getNearExpiryMaterials(daysAhead = 7) {
  const result = await query(
    `SELECT rm.id, rm.name, lot.supplier_lot_no, lot.expiry_date, lot.quantity_remaining::text,
            lot.unit
     FROM raw_material_lots lot
     JOIN raw_materials rm ON rm.id = lot.raw_material_id
     WHERE lot.quantity_remaining > 0 AND lot.expiry_date IS NOT NULL
       AND lot.expiry_date <= CURRENT_DATE + $1
     ORDER BY lot.expiry_date ASC`,
    [daysAhead]
  );
  return result.rows.map((r) => ({ ...r, quantityRemaining: parseFloat(r.quantity_remaining) }));
}

export async function setUnitConversion(params: {
  rawMaterialId: number; fromUnit: string; toUnit: string; factor: number; req: Request;
}) {
  await query(
    `INSERT INTO unit_conversions (raw_material_id, from_unit, to_unit, factor, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (raw_material_id, from_unit, to_unit)
     DO UPDATE SET factor = EXCLUDED.factor`,
    [params.rawMaterialId, params.fromUnit, params.toUnit, params.factor]
  );
  return { message: 'Unit conversion saved' };
}
