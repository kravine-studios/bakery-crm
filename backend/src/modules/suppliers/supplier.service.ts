import { query } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction } from '../../types/enums';
import type { Request } from 'express';

export async function listSuppliers(includeInactive = false) {
  const sql = includeInactive
    ? `SELECT id, name, contact_person, phone, email, address, city, state, gstin,
              payment_terms, rating_notes, is_active, opening_balance::text, created_at
       FROM suppliers ORDER BY name ASC`
    : `SELECT id, name, contact_person, phone, email, address, city, state, gstin,
              payment_terms, rating_notes, is_active, opening_balance::text, created_at
       FROM suppliers WHERE is_active = TRUE ORDER BY name ASC`;
  const result = await query(sql);
  return result.rows.map((r) => ({ ...r, openingBalance: parseFloat(r.opening_balance) }));
}

export async function getSupplierById(id: number) {
  const result = await query(
    `SELECT id, name, contact_person, phone, email, address, city, state, gstin,
            payment_terms, rating_notes, is_active, opening_balance::text, created_at
     FROM suppliers WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) throw new ApiError(404, 'Supplier not found');
  return { ...result.rows[0], openingBalance: parseFloat(result.rows[0].opening_balance) };
}

export async function getSupplierBalance(id: number) {
  const supplier = await getSupplierById(id);
  // Total purchases - total payments - opening balance = outstanding
  const purchasesResult = await query<{ total: string }>(
    `SELECT COALESCE(SUM(grand_total), 0)::text AS total FROM purchase_receipts WHERE supplier_id = $1`,
    [id]
  );
  const returnsResult = await query<{ total: string }>(
    `SELECT COALESCE(SUM(total_amount), 0)::text AS total FROM purchase_returns WHERE supplier_id = $1`,
    [id]
  );
  const paymentsResult = await query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS total FROM supplier_payments WHERE supplier_id = $1`,
    [id]
  );
  const totalPurchases = parseFloat(purchasesResult.rows[0].total);
  const totalReturns = parseFloat(returnsResult.rows[0].total);
  const totalPayments = parseFloat(paymentsResult.rows[0].total);
  const outstanding = supplier.openingBalance + totalPurchases - totalReturns - totalPayments;
  return { totalPurchases, totalReturns, totalPayments, outstanding };
}

export async function createSupplier(params: {
  name: string; contactPerson?: string; phone?: string; email?: string; address?: string;
  city?: string; state?: string; gstin?: string; paymentTerms?: string;
  ratingNotes?: string; openingBalance?: number; createdBy: number; req: Request;
}) {
  const result = await query<{ id: number }>(
    `INSERT INTO suppliers (name, contact_person, phone, email, address, city, state, gstin,
                           payment_terms, rating_notes, opening_balance, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, NOW(), NOW()) RETURNING id`,
    [params.name, params.contactPerson ?? null, params.phone ?? null, params.email ?? null,
     params.address ?? null, params.city ?? null, params.state ?? null, params.gstin ?? null,
     params.paymentTerms ?? null, params.ratingNotes ?? null, params.openingBalance ?? 0]
  );
  const id = result.rows[0].id;
  await auditLog({ userId: params.createdBy, action: AuditAction.Create, entity: 'supplier', entityId: id, after: params, req: params.req });
  return getSupplierById(id);
}

export async function updateSupplier(params: {
  id: number; name?: string; contactPerson?: string; phone?: string; email?: string;
  address?: string; city?: string; state?: string; gstin?: string; paymentTerms?: string;
  ratingNotes?: string; isActive?: boolean; updatedBy: number; req: Request;
}) {
  const before = await getSupplierById(params.id);
  const fields: Record<string, string> = {
    name: 'name', contactPerson: 'contact_person', phone: 'phone', email: 'email',
    address: 'address', city: 'city', state: 'state', gstin: 'gstin',
    paymentTerms: 'payment_terms', ratingNotes: 'rating_notes', isActive: 'is_active',
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
  await query(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = $${idx}`, values);
  const after = await getSupplierById(params.id);
  await auditLog({ userId: params.updatedBy, action: AuditAction.Update, entity: 'supplier', entityId: params.id, before, after, req: params.req });
  return after;
}

export async function getSupplierHistory(supplierId: number) {
  const receipts = await query(
    `SELECT id, grn_number, receipt_date, grand_total::text, supplier_invoice_no
     FROM purchase_receipts WHERE supplier_id = $1 ORDER BY receipt_date DESC`,
    [supplierId]
  );
  const payments = await query(
    `SELECT id, payment_date, amount::text, payment_mode, reference_no
     FROM supplier_payments WHERE supplier_id = $1 ORDER BY payment_date DESC`,
    [supplierId]
  );
  return {
    receipts: receipts.rows.map((r) => ({ ...r, grandTotal: parseFloat(r.grand_total) })),
    payments: payments.rows.map((p) => ({ ...p, amount: parseFloat(p.amount) })),
  };
}
