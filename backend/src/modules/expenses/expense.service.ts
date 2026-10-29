import { query } from '../../config/database';
import { auditLog } from '../../middleware/audit';
import { AuditAction, ExpenseCategory } from '../../types/enums';
import type { Request } from 'express';

export async function listExpenses(filters: { category?: ExpenseCategory; dateFrom?: string; dateTo?: string } = {}) {
  let sql = `SELECT e.id, e.expense_date, e.category, e.amount::text, e.payment_mode,
                    e.reference_no, e.description, u.display_name AS created_by_name
             FROM expenses e JOIN users u ON u.id = e.created_by WHERE 1=1`;
  const values: unknown[] = [];
  let idx = 1;
  if (filters.category) { sql += ` AND e.category = $${idx++}`; values.push(filters.category); }
  if (filters.dateFrom) { sql += ` AND e.expense_date >= $${idx++}`; values.push(filters.dateFrom); }
  if (filters.dateTo) { sql += ` AND e.expense_date <= $${idx++}`; values.push(filters.dateTo + ' 23:59:59'); }
  sql += ` ORDER BY e.expense_date DESC`;
  const result = await query(sql, values);
  return result.rows.map((r) => ({ ...r, amount: parseFloat(r.amount) }));
}

export async function createExpense(params: {
  category: ExpenseCategory; amount: number; paymentMode?: string; referenceNo?: string;
  description?: string; expenseDate?: string; createdBy: number; req: Request;
}) {
  const result = await query<{ id: number }>(
    `INSERT INTO expenses (expense_date, category, amount, payment_mode, reference_no, description, created_by, created_at)
     VALUES (COALESCE($1::timestamptz, NOW()), $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
    [params.expenseDate ?? null, params.category, params.amount, params.paymentMode ?? 'cash',
     params.referenceNo ?? null, params.description ?? null, params.createdBy]
  );
  const id = result.rows[0].id;
  await auditLog({ userId: params.createdBy, action: AuditAction.Create, entity: 'expense', entityId: id, after: params, req: params.req });
  return { expenseId: id };
}

export async function getExpenseSummary(dateFrom: string, dateTo: string) {
  const result = await query(
    `SELECT category, SUM(amount)::text AS total FROM expenses
     WHERE expense_date >= $1 AND expense_date <= $2
     GROUP BY category ORDER BY total DESC`,
    [dateFrom, dateTo + ' 23:59:59']
  );
  return result.rows.map((r) => ({ ...r, total: parseFloat(r.total) }));
}
