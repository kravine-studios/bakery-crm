import { query } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction } from '../../types/enums';
import type { Request } from 'express';

export async function listCustomers(filters: { search?: string; isCredit?: boolean } = {}) {
  let sql = `SELECT id, name, phone, email, birthday, anniversary, address, notes,
                    is_credit_customer, credit_limit::text, credit_balance::text,
                    loyalty_points, is_active, created_at
             FROM customers WHERE is_active = TRUE`;
  const values: unknown[] = [];
  let idx = 1;
  if (filters.isCredit !== undefined) { sql += ` AND is_credit_customer = $${idx++}`; values.push(filters.isCredit); }
  if (filters.search) {
    sql += ` AND (name ILIKE $${idx} OR phone ILIKE $${idx})`;
    values.push(`%${filters.search}%`);
    idx++;
  }
  sql += ` ORDER BY name ASC LIMIT 100`;
  const result = await query(sql, values);
  return result.rows.map((r) => ({
    ...r,
    creditLimit: parseFloat(r.credit_limit),
    creditBalance: parseFloat(r.credit_balance),
  }));
}

export async function getCustomerById(id: number) {
  const result = await query(
    `SELECT id, name, phone, email, birthday, anniversary, address, notes,
            is_credit_customer, credit_limit::text, credit_balance::text,
            loyalty_points, is_active, created_at
     FROM customers WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) throw new ApiError(404, 'Customer not found');
  return { ...result.rows[0], creditLimit: parseFloat(result.rows[0].credit_limit), creditBalance: parseFloat(result.rows[0].credit_balance) };
}

export async function findOrCreateByPhone(phone: string, name?: string, req?: Request, createdBy?: number) {
  const existing = await query('SELECT id FROM customers WHERE phone = $1', [phone]);
  if (existing.rowCount) return { id: existing.rows[0].id, isNew: false };
  const result = await query<{ id: number }>(
    `INSERT INTO customers (name, phone, is_active, created_at, updated_at)
     VALUES ($1, $2, TRUE, NOW(), NOW()) RETURNING id`,
    [name ?? 'Walk-in', phone]
  );
  if (createdBy && req) {
    await auditLog({ userId: createdBy, action: AuditAction.Create, entity: 'customer', entityId: result.rows[0].id, after: { phone, name }, req });
  }
  return { id: result.rows[0].id, isNew: true };
}

export async function createCustomer(params: {
  name: string; phone: string; email?: string; birthday?: string; anniversary?: string;
  address?: string; notes?: string; isCreditCustomer?: boolean; creditLimit?: number;
  createdBy: number; req: Request;
}) {
  const result = await query<{ id: number }>(
    `INSERT INTO customers (name, phone, email, birthday, anniversary, address, notes,
                          is_credit_customer, credit_limit, credit_balance, loyalty_points,
                          is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, TRUE, NOW(), NOW())
     RETURNING id`,
    [params.name, params.phone, params.email ?? null, params.birthday ?? null,
     params.anniversary ?? null, params.address ?? null, params.notes ?? null,
     params.isCreditCustomer ?? false, params.creditLimit ?? 0]
  );
  const id = result.rows[0].id;
  await auditLog({ userId: params.createdBy, action: AuditAction.Create, entity: 'customer', entityId: id, after: params, req: params.req });
  return getCustomerById(id);
}

export async function updateCustomer(params: {
  id: number; name?: string; phone?: string; email?: string; birthday?: string;
  anniversary?: string; address?: string; notes?: string; isCreditCustomer?: boolean;
  creditLimit?: number; isActive?: boolean; updatedBy: number; req: Request;
}) {
  const before = await getCustomerById(params.id);
  const fields: Record<string, string> = {
    name: 'name', phone: 'phone', email: 'email', birthday: 'birthday', anniversary: 'anniversary',
    address: 'address', notes: 'notes', isCreditCustomer: 'is_credit_customer',
    creditLimit: 'credit_limit', isActive: 'is_active',
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
  await query(`UPDATE customers SET ${updates.join(', ')} WHERE id = $${idx}`, values);
  const after = await getCustomerById(params.id);
  await auditLog({ userId: params.updatedBy, action: AuditAction.Update, entity: 'customer', entityId: params.id, before, after, req: params.req });
  return after;
}

export async function getCustomerHistory(customerId: number) {
  const bills = await query(
    `SELECT b.id, b.invoice_number, b.bill_date, b.grand_total::text, b.status,
            (SELECT SUM(bi.quantity::text::numeric) FROM bill_items bi WHERE bi.bill_id = b.id) AS total_items
     FROM bills b WHERE b.customer_id = $1 ORDER BY b.bill_date DESC`,
    [customerId]
  );
  const loyalty = await query(
    `SELECT id, type, points, balance_after, created_at FROM loyalty_transactions
     WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [customerId]
  );
  // Favourite items
  const favourites = await query(
    `SELECT bi.item_name, SUM(bi.quantity)::text AS total_qty, COUNT(*) AS times_bought
     FROM bill_items bi JOIN bills b ON b.id = bi.bill_id
     WHERE b.customer_id = $1 AND b.status != 'cancelled'
     GROUP BY bi.item_name ORDER BY times_bought DESC LIMIT 10`,
    [customerId]
  );
  return {
    bills: bills.rows.map((b) => ({ ...b, grandTotal: parseFloat(b.grand_total) })),
    loyalty: loyalty.rows,
    favourites: favourites.rows.map((f) => ({ ...f, totalQty: parseFloat(f.total_qty) })),
  };
}
