import { query } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction } from '../../types/enums';
import type { Request } from 'express';

interface CategoryRow {
  id: number;
  name: string;
  parent_id: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export async function listCategories(includeInactive = false) {
  const sql = includeInactive
    ? `SELECT id, name, parent_id, is_active, sort_order, created_at
       FROM categories ORDER BY sort_order ASC, name ASC`
    : `SELECT id, name, parent_id, is_active, sort_order, created_at
       FROM categories WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`;
  const result = await query<CategoryRow>(sql);
  return result.rows;
}

export async function getCategoryById(id: number) {
  const result = await query<CategoryRow>(
    `SELECT id, name, parent_id, is_active, sort_order, created_at
     FROM categories WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) throw new ApiError(404, 'Category not found');
  return result.rows[0];
}

export async function createCategory(params: {
  name: string;
  parentId?: number;
  sortOrder?: number;
  createdBy: number;
  req: Request;
}) {
  const result = await query<{ id: number }>(
    `INSERT INTO categories (name, parent_id, sort_order, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, TRUE, NOW(), NOW()) RETURNING id`,
    [params.name, params.parentId ?? null, params.sortOrder ?? 0]
  );
  const id = result.rows[0].id;
  await auditLog({
    userId: params.createdBy,
    action: AuditAction.Create,
    entity: 'category',
    entityId: id,
    after: { name: params.name, parentId: params.parentId },
    req: params.req,
  });
  return getCategoryById(id);
}

export async function updateCategory(params: {
  id: number;
  name?: string;
  parentId?: number;
  sortOrder?: number;
  isActive?: boolean;
  updatedBy: number;
  req: Request;
}) {
  const before = await getCategoryById(params.id);
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.name !== undefined) { updates.push(`name = $${idx++}`); values.push(params.name); }
  if (params.parentId !== undefined) { updates.push(`parent_id = $${idx++}`); values.push(params.parentId); }
  if (params.sortOrder !== undefined) { updates.push(`sort_order = $${idx++}`); values.push(params.sortOrder); }
  if (params.isActive !== undefined) { updates.push(`is_active = $${idx++}`); values.push(params.isActive); }

  if (updates.length === 0) return before;

  values.push(params.id);
  await query(`UPDATE categories SET ${updates.join(', ')} WHERE id = $${idx}`, values);
  const after = await getCategoryById(params.id);
  await auditLog({
    userId: params.updatedBy,
    action: AuditAction.Update,
    entity: 'category',
    entityId: params.id,
    before, after,
    req: params.req,
  });
  return after;
}
