import { query } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction } from '../../types/enums';
import type { Request } from 'express';

export async function listRecipes(productId?: number) {
  let sql = `SELECT r.id, r.name, r.product_id, p.name AS product_name,
                    r.batch_size::text, r.batch_unit, r.expected_yield::text, r.yield_unit,
                    r.allowed_wastage_pct::text, r.is_active, r.is_default
             FROM recipes r JOIN products p ON p.id = r.product_id
             WHERE 1=1`;
  const values: unknown[] = [];
  if (productId) { sql += ` AND r.product_id = $1`; values.push(productId); }
  sql += ` ORDER BY r.product_id, r.is_default DESC, r.name ASC`;
  const result = await query(sql, values);
  return result.rows.map((r) => ({
    ...r,
    batchSize: parseFloat(r.batch_size),
    expectedYield: parseFloat(r.expected_yield),
    allowedWastagePct: parseFloat(r.allowed_wastage_pct),
  }));
}

export async function getRecipeById(id: number) {
  const recipeResult = await query(
    `SELECT r.id, r.name, r.product_id, p.name AS product_name,
            r.batch_size::text, r.batch_unit, r.expected_yield::text, r.yield_unit,
            r.allowed_wastage_pct::text, r.is_active, r.is_default, r.notes
     FROM recipes r JOIN products p ON p.id = r.product_id
     WHERE r.id = $1`,
    [id]
  );
  if (recipeResult.rowCount === 0) throw new ApiError(404, 'Recipe not found');
  const recipe = recipeResult.rows[0];

  const items = await query(
    `SELECT ri.id, ri.raw_material_id, rm.name AS raw_material_name,
            ri.quantity::text, ri.unit, ri.notes
     FROM recipe_items ri JOIN raw_materials rm ON rm.id = ri.raw_material_id
     WHERE ri.recipe_id = $1`,
    [id]
  );

  return {
    ...recipe,
    batchSize: parseFloat(recipe.batch_size),
    expectedYield: parseFloat(recipe.expected_yield),
    allowedWastagePct: parseFloat(recipe.allowed_wastage_pct),
    items: items.rows.map((i) => ({ ...i, quantity: parseFloat(i.quantity) })),
  };
}

interface CreateRecipeParams {
  productId: number;
  name: string;
  batchSize: number;
  batchUnit: string;
  expectedYield: number;
  yieldUnit: string;
  allowedWastagePct?: number;
  isDefault?: boolean;
  notes?: string;
  items: Array<{ rawMaterialId: number; quantity: number; unit: string; notes?: string }>;
  createdBy: number;
  req: Request;
}

export async function createRecipe(params: CreateRecipeParams) {
  const result = await query<{ id: number }>(
    `INSERT INTO recipes (product_id, name, batch_size, batch_unit, expected_yield, yield_unit,
                         allowed_wastage_pct, is_active, is_default, notes, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10, NOW(), NOW()) RETURNING id`,
    [params.productId, params.name, params.batchSize, params.batchUnit, params.expectedYield,
     params.yieldUnit, params.allowedWastagePct ?? 0, params.isDefault ?? false,
     params.notes ?? null, params.createdBy]
  );
  const id = result.rows[0].id;

  for (const item of params.items) {
    await query(
      `INSERT INTO recipe_items (recipe_id, raw_material_id, quantity, unit, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (recipe_id, raw_material_id)
       DO UPDATE SET quantity = EXCLUDED.quantity, unit = EXCLUDED.unit`,
      [id, item.rawMaterialId, item.quantity, item.unit, item.notes ?? null]
    );
  }

  await auditLog({ userId: params.createdBy, action: AuditAction.Create, entity: 'recipe', entityId: id, after: params, req: params.req });
  return getRecipeById(id);
}
