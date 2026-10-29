import { query, withTransaction } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction } from '../../types/enums';
import type { Request } from 'express';

interface ProductRow {
  id: number;
  product_code: string;
  name: string;
  category_id: number;
  product_type: 'produced' | 'traded';
  sku: string | null;
  hsn_code: string | null;
  gst_rate: string;
  selling_unit: string;
  mrp: string | null;
  selling_price: string;
  cost_price: string;
  is_weighed: boolean;
  food_type: 'veg' | 'non_veg' | 'egg';
  allergens: string[] | null;
  shelf_life_days: number | null;
  image_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface VariantRow {
  id: number;
  product_id: number;
  name: string;
  unit: string;
  weight_value: string | null;
  selling_price: string;
  cost_price: string;
  mrp: string | null;
  is_active: boolean;
}

function parseProduct(r: ProductRow) {
  return {
    ...r,
    productCode: r.product_code,
    gstRate: parseFloat(r.gst_rate),
    mrp: r.mrp !== null ? parseFloat(r.mrp) : null,
    sellingPrice: parseFloat(r.selling_price),
    costPrice: parseFloat(r.cost_price),
  };
}

function parseVariant(r: VariantRow) {
  return {
    ...r,
    weightValue: r.weight_value !== null ? parseFloat(r.weight_value) : null,
    sellingPrice: parseFloat(r.selling_price),
    costPrice: parseFloat(r.cost_price),
    mrp: r.mrp !== null ? parseFloat(r.mrp) : null,
  };
}

/** Generate the next product code atomically (e.g. 013, 014 …) */
async function nextProductCode(): Promise<string> {
  const result = await query<{ last_code: string }>(
    `INSERT INTO product_code_sequence (last_code) VALUES (1)
     ON CONFLICT (id) DO UPDATE SET last_code = product_code_sequence.last_code + 1
     RETURNING last_code`
  );
  return String(result.rows[0].last_code).padStart(3, '0');
}

/** Look up a product by its short code — used for billing code-entry. */
export async function getProductByCode(code: string) {
  const result = await query<ProductRow>(
    `SELECT id, product_code, name, category_id, product_type, sku, hsn_code, gst_rate,
            selling_unit, mrp, selling_price, cost_price, is_weighed, food_type,
            allergens, shelf_life_days, image_url, description, is_active, created_at
     FROM products WHERE product_code = $1 AND is_active = TRUE`,
    [code]
  );
  if (result.rowCount === 0) return null;
  return parseProduct(result.rows[0]);
}

export async function listProducts(filters: { categoryId?: number; search?: string; isActive?: boolean } = {}) {
  let sql = `SELECT id, product_code, name, category_id, product_type, sku, hsn_code, gst_rate,
                    selling_unit, mrp, selling_price, cost_price, is_weighed, food_type,
                    allergens, shelf_life_days, image_url, description, is_active, created_at
             FROM products WHERE 1=1`;
  const values: unknown[] = [];
  let idx = 1;

  if (filters.isActive !== undefined) {
    sql += ` AND is_active = $${idx++}`;
    values.push(filters.isActive);
  }
  if (filters.categoryId !== undefined) {
    sql += ` AND category_id = $${idx++}`;
    values.push(filters.categoryId);
  }
  if (filters.search) {
    sql += ` AND (name ILIKE $${idx} OR sku ILIKE $${idx} OR product_code ILIKE $${idx})`;
    values.push(`%${filters.search}%`);
    idx++;
  }
  sql += ` ORDER BY product_code ASC`;

  const result = await query<ProductRow>(sql, values);
  return result.rows.map(parseProduct);
}

export async function getProductById(id: number) {
  const result = await query<ProductRow>(
    `SELECT id, product_code, name, category_id, product_type, sku, hsn_code, gst_rate,
            selling_unit, mrp, selling_price, cost_price, is_weighed, food_type,
            allergens, shelf_life_days, image_url, description, is_active, created_at
     FROM products WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) throw new ApiError(404, 'Product not found');
  return parseProduct(result.rows[0]);
}

export async function getProductVariants(productId: number) {
  const result = await query<VariantRow>(
    `SELECT id, product_id, name, unit, weight_value, selling_price, cost_price, mrp, is_active
     FROM product_variants WHERE product_id = $1 ORDER BY id ASC`,
    [productId]
  );
  return result.rows.map(parseVariant);
}

interface CreateProductParams {
  name: string;
  categoryId: number;
  productType: 'produced' | 'traded';
  productCode?: string;  // if not supplied, auto-generated
  sku?: string;
  hsnCode?: string;
  gstRate: number;
  sellingUnit: string;
  mrp?: number;
  sellingPrice: number;
  costPrice: number;
  isWeighed?: boolean;
  foodType?: 'veg' | 'non_veg' | 'egg';
  allergens?: string[];
  shelfLifeDays?: number;
  imageUrl?: string;
  description?: string;
  createdBy: number;
  req: Request;
}

export async function createProduct(params: CreateProductParams) {
  // Auto-generate product code if not provided
  const code = params.productCode?.trim() || await nextProductCode();

  // Enforce uniqueness (belt-and-suspenders — DB constraint is the final guard)
  const existing = await query('SELECT id FROM products WHERE product_code = $1', [code]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new ApiError(409, `Product code "${code}" is already in use`);
  }

  const result = await query<{ id: number }>(
    `INSERT INTO products (product_code, name, category_id, product_type, sku, hsn_code,
                           gst_rate, selling_unit, mrp, selling_price, cost_price,
                           is_weighed, food_type, allergens, shelf_life_days, image_url,
                           description, is_active, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, TRUE, $18, NOW(), NOW())
     RETURNING id`,
    [
      code, params.name, params.categoryId, params.productType,
      params.sku ?? null, params.hsnCode ?? null,
      params.gstRate, params.sellingUnit, params.mrp ?? null,
      params.sellingPrice, params.costPrice,
      params.isWeighed ?? false, params.foodType ?? 'veg', params.allergens ?? null,
      params.shelfLifeDays ?? null, params.imageUrl ?? null, params.description ?? null,
      params.createdBy,
    ]
  );
  const id = result.rows[0].id;

  // Record initial price in price history (PRD 5.2)
  await query(
    `INSERT INTO price_history (product_id, old_price, new_price, field, changed_by, changed_at, reason)
     VALUES ($1, NULL, $2, 'selling_price', $3, NOW(), 'Initial price')`,
    [id, params.sellingPrice, params.createdBy]
  );

  await auditLog({
    userId: params.createdBy,
    action: AuditAction.Create,
    entity: 'product',
    entityId: id,
    after: { ...params, productCode: code },
    req: params.req,
  });

  return getProductById(id);
}

interface UpdateProductParams {
  id: number;
  name?: string;
  categoryId?: number;
  sku?: string;
  hsnCode?: string;
  gstRate?: number;
  sellingUnit?: string;
  mrp?: number;
  sellingPrice?: number;
  costPrice?: number;
  isWeighed?: boolean;
  foodType?: 'veg' | 'non_veg' | 'egg';
  allergens?: string[];
  shelfLifeDays?: number;
  imageUrl?: string;
  description?: string;
  isActive?: boolean;
  updatedBy: number;
  req: Request;
}

export async function updateProduct(params: UpdateProductParams) {
  const before = await getProductById(params.id);
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fields = ['name', 'categoryId:category_id', 'sku', 'hsnCode:hsn_code', 'gstRate:gst_rate',
    'sellingUnit:selling_unit', 'mrp', 'sellingPrice:selling_price', 'costPrice:cost_price',
    'isWeighed:is_weighed', 'foodType:food_type', 'allergens', 'shelfLifeDays:shelf_life_days',
    'imageUrl:image_url', 'description', 'isActive:is_active'];

  for (const field of fields) {
    const [paramName, colName] = field.includes(':') ? field.split(':') : [field, field];
    const val = (params as Record<string, unknown>)[paramName];
    if (val !== undefined) {
      updates.push(`${colName} = $${idx++}`);
      values.push(val);
    }
  }

  if (updates.length === 0) return before;

  values.push(params.id);
  await query(`UPDATE products SET ${updates.join(', ')} WHERE id = $${idx}`, values);

  // If selling price changed, record in price history (PRD 5.2)
  if (params.sellingPrice !== undefined && params.sellingPrice !== before.sellingPrice) {
    await query(
      `INSERT INTO price_history (product_id, old_price, new_price, field, changed_by, changed_at)
       VALUES ($1, $2, $3, 'selling_price', $4, NOW())`,
      [params.id, before.sellingPrice, params.sellingPrice, params.updatedBy]
    );
  }

  const after = await getProductById(params.id);
  await auditLog({
    userId: params.updatedBy,
    action: AuditAction.Update,
    entity: 'product',
    entityId: params.id,
    before, after,
    req: params.req,
  });

  return after;
}

interface CreateVariantParams {
  productId: number;
  name: string;
  unit: string;
  weightValue?: number;
  sellingPrice: number;
  costPrice: number;
  mrp?: number;
  createdBy: number;
  req: Request;
}

export async function createVariant(params: CreateVariantParams) {
  const result = await query<{ id: number }>(
    `INSERT INTO product_variants (product_id, name, unit, weight_value, selling_price, cost_price, mrp, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW()) RETURNING id`,
    [params.productId, params.name, params.unit, params.weightValue ?? null,
     params.sellingPrice, params.costPrice, params.mrp ?? null]
  );
  const id = result.rows[0].id;
  await auditLog({
    userId: params.createdBy,
    action: AuditAction.Create,
    entity: 'variant',
    entityId: id,
    after: params,
    req: params.req,
  });
  return (await getProductVariants(params.productId)).find((v) => v.id === id);
}

export async function getPriceHistory(productId: number) {
  const result = await query(
    `SELECT ph.id, ph.product_id, ph.variant_id, ph.old_price::text, ph.new_price::text,
            ph.field, u.display_name AS changed_by_name, ph.changed_at, ph.reason
     FROM price_history ph
     JOIN users u ON u.id = ph.changed_by
     WHERE ph.product_id = $1
     ORDER BY ph.changed_at DESC`,
    [productId]
  );
  return result.rows.map((r) => ({
    ...r,
    oldPrice: r.old_price ? parseFloat(r.old_price) : null,
    newPrice: parseFloat(r.new_price),
  }));
}
