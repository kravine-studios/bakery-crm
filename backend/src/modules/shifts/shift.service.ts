import { query, withTransaction } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction, CashEntryType } from '../../types/enums';
import type { Request } from 'express';

export async function openShift(params: { cashierId: number; openingFloat: number; req: Request }) {
  // Check if cashier already has an open shift
  const existing = await query(
    `SELECT id FROM shifts WHERE cashier_id = $1 AND status = 'open'`,
    [params.cashierId]
  );
  if (existing.rowCount) throw new ApiError(400, 'You already have an open shift. Close it first.');

  const result = await query<{ id: number }>(
    `INSERT INTO shifts (cashier_id, status, opened_at, opening_float, created_at)
     VALUES ($1, 'open', NOW(), $2, NOW()) RETURNING id`,
    [params.cashierId, params.openingFloat]
  );
  const shiftId = result.rows[0].id;

  await auditLog({ userId: params.cashierId, action: AuditAction.Create, entity: 'shift', entityId: shiftId, after: { openingFloat: params.openingFloat }, req: params.req });
  return { shiftId };
}

export async function closeShift(params: { shiftId: number; countedCash: number; notes?: string; closedBy: number; req: Request }) {
  return withTransaction(async (client) => {
    const shiftResult = await client.query(
      `SELECT id, cashier_id, status, opening_float::text FROM shifts WHERE id = $1`,
      [params.shiftId]
    );
    if (shiftResult.rowCount === 0) throw new ApiError(404, 'Shift not found');
    const shift = shiftResult.rows[0];
    if (shift.status === 'closed') throw new ApiError(400, 'Shift already closed');

    // Calculate expected cash from bills (cash payments only)
    const cashSalesResult = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(p.amount), 0)::text AS total
       FROM payments p
       JOIN bills b ON b.id = p.bill_id
       WHERE b.shift_id = $1 AND p.payment_mode = 'cash' AND b.status != 'cancelled'`,
      [params.shiftId]
    );
    const cashReturnsResult = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(p.amount), 0)::text AS total
       FROM payments p
       JOIN credit_notes cn ON cn.original_bill_id = p.bill_id
       JOIN bills b ON b.id = p.bill_id
       WHERE b.shift_id = $1 AND p.payment_mode = 'cash'`,
      [params.shiftId]
    );

    // Add cash in/out entries
    const cashInResult = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total FROM cash_entries WHERE shift_id = $1 AND entry_type = 'cash_in'`,
      [params.shiftId]
    );
    const cashOutResult = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total FROM cash_entries WHERE shift_id = $1 AND entry_type = 'cash_out'`,
      [params.shiftId]
    );

    const openingFloat = parseFloat(shift.opening_float);
    const cashSales = parseFloat(cashSalesResult.rows[0].total);
    const cashReturns = parseFloat(cashReturnsResult.rows[0].total);
    const cashIn = parseFloat(cashInResult.rows[0].total);
    const cashOut = parseFloat(cashOutResult.rows[0].total);

    const expectedCash = openingFloat + cashSales - cashReturns + cashIn - cashOut;
    const shortage = params.countedCash - expectedCash;

    await client.query(
      `UPDATE shifts SET status = 'closed', closed_at = NOW(), expected_cash = $1,
                         counted_cash = $2, shortage = $3, notes = $4, closed_by = $5
       WHERE id = $6`,
      [expectedCash, params.countedCash, shortage, params.notes ?? null, params.closedBy, params.shiftId]
    );

    await auditLog({ userId: params.closedBy, action: AuditAction.Update, entity: 'shift', entityId: params.shiftId, after: { expectedCash, countedCash: params.countedCash, shortage }, req: params.req });

    return {
      shiftId: params.shiftId,
      openingFloat,
      cashSales,
      cashReturns,
      cashIn,
      cashOut,
      expectedCash,
      countedCash: params.countedCash,
      shortage,
    };
  });
}

export async function addCashEntry(params: {
  shiftId: number; entryType: CashEntryType; amount: number; reason?: string;
  referenceType?: string; referenceId?: number; createdBy: number; req: Request;
}) {
  const result = await query<{ id: number }>(
    `INSERT INTO cash_entries (shift_id, entry_type, amount, reason, reference_type, reference_id, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
    [params.shiftId, params.entryType, params.amount, params.reason ?? null,
     params.referenceType ?? null, params.referenceId ?? null, params.createdBy]
  );
  await auditLog({ userId: params.createdBy, action: AuditAction.Create, entity: 'cash_entry', entityId: result.rows[0].id, after: params, req: params.req });
  return { entryId: result.rows[0].id };
}

export async function getDayEndReport(shiftId: number) {
  const shiftResult = await query(
    `SELECT s.id, s.cashier_id, u.display_name AS cashier_name, s.status, s.opened_at,
            s.closed_at, s.opening_float::text, s.expected_cash::text, s.counted_cash::text,
            s.shortage::text, s.notes
     FROM shifts s JOIN users u ON u.id = s.cashier_id
     WHERE s.id = $1`,
    [shiftId]
  );
  if (shiftResult.rowCount === 0) throw new ApiError(404, 'Shift not found');

  // Sales by payment mode
  const salesByMode = await query(
    `SELECT p.payment_mode, COUNT(*) AS bill_count, SUM(p.amount)::text AS total
     FROM payments p JOIN bills b ON b.id = p.bill_id
     WHERE b.shift_id = $1 AND b.status != 'cancelled'
     GROUP BY p.payment_mode`,
    [shiftId]
  );

  // Discounts and returns
  const discounts = await query(
    `SELECT COALESCE(SUM(total_discount), 0)::text AS total FROM bills WHERE shift_id = $1 AND status != 'cancelled'`,
    [shiftId]
  );

  const shift = shiftResult.rows[0];
  return {
    ...shift,
    openingFloat: parseFloat(shift.opening_float),
    expectedCash: shift.expected_cash ? parseFloat(shift.expected_cash) : null,
    countedCash: shift.counted_cash ? parseFloat(shift.counted_cash) : null,
    shortage: shift.shortage ? parseFloat(shift.shortage) : null,
    salesByMode: salesByMode.rows.map((r) => ({ ...r, total: parseFloat(r.total) })),
    totalDiscounts: parseFloat(discounts.rows[0].total),
  };
}
