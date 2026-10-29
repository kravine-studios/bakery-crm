import { query } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction } from '../../types/enums';
import type { Request } from 'express';

export async function getSettings() {
  const result = await query(
    `SELECT id, shop_name, logo_url, address, phone, email, gstin, fssai_number,
            invoice_prefix, invoice_footer, tax_inclusive, currency, receipt_paper,
            stock_block_zero, loyalty_enabled, loyalty_points_per_rupee::text,
            loyalty_min_redeem
     FROM settings WHERE id = 1`
  );
  if (result.rowCount === 0) throw new ApiError(404, 'Settings not found');
  const r = result.rows[0];
  return {
    ...r,
    loyaltyPointsPerRupee: parseFloat(r.loyalty_points_per_rupee),
  };
}

export async function updateSettings(params: {
  shopName?: string; logoUrl?: string; address?: string; phone?: string; email?: string;
  gstin?: string; fssaiNumber?: string; invoicePrefix?: string; invoiceFooter?: string;
  taxInclusive?: boolean; currency?: string; receiptPaper?: string;
  stockBlockZero?: boolean; loyaltyEnabled?: boolean;
  loyaltyPointsPerRupee?: number; loyaltyMinRedeem?: number;
  updatedBy: number; req: Request;
}) {
  const before = await getSettings();
  const fields: Record<string, string> = {
    shopName: 'shop_name', logoUrl: 'logo_url', address: 'address', phone: 'phone',
    email: 'email', gstin: 'gstin', fssaiNumber: 'fssai_number', invoicePrefix: 'invoice_prefix',
    invoiceFooter: 'invoice_footer', taxInclusive: 'tax_inclusive', currency: 'currency',
    receiptPaper: 'receipt_paper', stockBlockZero: 'stock_block_zero',
    loyaltyEnabled: 'loyalty_enabled', loyaltyPointsPerRupee: 'loyalty_points_per_rupee',
    loyaltyMinRedeem: 'loyalty_min_redeem',
  };
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const [param, col] of Object.entries(fields)) {
    const val = (params as Record<string, unknown>)[param];
    if (val !== undefined) { updates.push(`${col} = $${idx++}`); values.push(val); }
  }
  if (updates.length === 0) return before;

  values.push(params.updatedBy);
  values.push(1);
  await query(
    `UPDATE settings SET ${updates.join(', ')}, updated_at = NOW(), updated_by = $${idx++} WHERE id = $${idx}`,
    values
  );
  const after = await getSettings();
  await auditLog({ userId: params.updatedBy, action: AuditAction.Update, entity: 'settings', entityId: 1, before, after, req: params.req });
  return after;
}

// ─── Audit Log ────────────────────────────────────────────

export async function getAuditLog(filters: { userId?: number; entity?: string; action?: string; dateFrom?: string; dateTo?: string; limit?: number } = {}) {
  let sql = `SELECT a.id, a.user_id, u.display_name AS user_name, a.action, a.entity, a.entity_id,
                    a.before, a.after, a.ip_address, a.reason, a.created_at
             FROM audit_log a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE 1=1`;
  const values: unknown[] = [];
  let idx = 1;
  if (filters.userId) { sql += ` AND a.user_id = $${idx++}`; values.push(filters.userId); }
  if (filters.entity) { sql += ` AND a.entity = $${idx++}`; values.push(filters.entity); }
  if (filters.action) { sql += ` AND a.action = $${idx++}`; values.push(filters.action); }
  if (filters.dateFrom) { sql += ` AND a.created_at >= $${idx++}`; values.push(filters.dateFrom); }
  if (filters.dateTo) { sql += ` AND a.created_at <= $${idx++}`; values.push(filters.dateTo + ' 23:59:59'); }
  sql += ` ORDER BY a.created_at DESC LIMIT $${idx++}`;
  values.push(filters.limit ?? 100);
  const result = await query(sql, values);
  return result.rows;
}
