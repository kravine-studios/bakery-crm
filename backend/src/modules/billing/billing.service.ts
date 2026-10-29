import { query, withTransaction } from '../../config/database';
import { env } from '../../config/env';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction, BillStatus, PaymentMode, Role } from '../../types/enums';
import type { PoolClient } from 'pg';
import type { Request } from 'express';

// ─── Types ──────────────────────────────────────────────

interface BillItemInput {
  productId?: number;
  variantId?: number;
  comboId?: number;
  batchId?: number;
  name: string;
  hsnCode?: string;
  quantity: number;
  unit: string;
  rate: number;
  discountAmount?: number;
  gstRate: number;
  notes?: string;
}

interface PaymentInput {
  paymentMode: PaymentMode;
  amount: number;
  referenceNo?: string;
}

interface CreateBillParams {
  items: BillItemInput[];
  payments: PaymentInput[];
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  cashierId: number;
  shiftId?: number;
  req: Request;
}

// ─── Invoice Numbering ──────────────────────────────────

/** Generate the next gap-free invoice number for the current FY (PRD 5.7). */
async function nextInvoiceNumber(client: PoolClient): Promise<{ number: string; finYear: string }> {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const fyStart = env.fyStartMonth;   // 4 for April
  const year = now.getFullYear();
  const fyStartYear = month >= fyStart ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  const finYear = `FY${fyStartYear}-${String(fyEndYear).slice(-2)}`;

  // Upsert the sequence row and increment in one atomic call
  const result = await client.query<{ last_number: string }>(
    `INSERT INTO invoice_sequences (fin_year, last_number) VALUES ($1, 1)
     ON CONFLICT (fin_year)
     DO UPDATE SET last_number = invoice_sequences.last_number + 1
     RETURNING last_number`,
    [finYear]
  );
  const seq = parseInt(result.rows[0].last_number, 10);
  const number = `${env.invoicePrefix}-${finYear}-${String(seq).padStart(5, '0')}`;

  return { number, finYear };
}

// ─── Number to Words (for A4 invoice) ────────────────────

/** Convert a number to Indian English words for the amount-in-words line. */
export function numberToWords(num: number): string {
  if (num === 0) return 'Zero rupees only';
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
    'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function twoDigits(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '');
  }

  function threeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let str = '';
    if (h > 0) str += ones[h] + ' hundred';
    if (rem > 0) str += (h > 0 ? ' ' : '') + twoDigits(rem);
    return str;
  }

  const intPart = Math.floor(num);
  const paise = Math.round((num - intPart) * 100);
  const groups = [
    { value: 10000000, name: 'crore' },
    { value: 100000, name: 'lakh' },
    { value: 1000, name: 'thousand' },
    { value: 100, name: 'hundred' },
  ];

  let words = '';
  let remaining = intPart;
  for (const g of groups) {
    const count = Math.floor(remaining / g.value);
    if (count > 0) {
      if (g.name === 'hundred') {
        words += threeDigits(count) + ' ';
      } else {
        words += threeDigits(count) + ' ' + g.name + ' ';
      }
      remaining %= g.value;
    }
  }
  if (remaining > 0) words += twoDigits(remaining);
  words = words.trim() || 'zero';
  let result = words.charAt(0).toUpperCase() + words.slice(1) + ' rupees';
  if (paise > 0) result += ` and ${twoDigits(paise)} paise`;
  return result + ' only';
}

// ─── Tax Calculation ─────────────────────────────────────

interface TaxBreakdown {
  baseAmount: number;
  discountAmount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

function calculateLineTax(item: BillItemInput, taxInclusive: boolean): TaxBreakdown {
  const baseAmount = item.quantity * item.rate;
  const discountAmount = item.discountAmount ?? 0;
  let taxableValue = baseAmount - discountAmount;

  let cgst = 0, sgst = 0;
  // For now: CGST + SGST split. IGST applies for inter-state (not in scope for single shop).
  if (taxInclusive) {
    // Price is tax-inclusive: back-calculate taxable value
    const totalGstRate = item.gstRate / 100;
    taxableValue = taxableValue / (1 + totalGstRate);
  }

  const gst = taxableValue * (item.gstRate / 100);
  cgst = gst / 2;
  sgst = gst / 2;
  const total = taxInclusive ? baseAmount - discountAmount : taxableValue + gst;

  return {
    baseAmount: round2(baseAmount),
    discountAmount: round2(discountAmount),
    taxableValue: round2(taxableValue),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: 0,
    total: round2(total),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─── Bill Operations ─────────────────────────────────────

export async function createBill(params: CreateBillParams) {
  return withTransaction(async (client) => {
    // Fetch settings for tax-inclusive flag
    const settingsResult = await client.query<{ tax_inclusive: boolean; stock_block_zero: boolean }>(
      'SELECT tax_inclusive, stock_block_zero FROM settings WHERE id = 1'
    );
    const settings = settingsResult.rows[0];

    // Validate discount limits per role (PRD 3)
    const cashierResult = await client.query<{ role: Role; discount_limit: string }>(
      'SELECT role, discount_limit::text FROM users WHERE id = $1',
      [params.cashierId]
    );
    const cashier = cashierResult.rows[0];
    const cashierDiscountLimit = parseFloat(cashier.discount_limit);

    // Check stock availability and FEFO for each item (PRD 5.6, 5.7)
    const lineItems: Array<BillItemInput & TaxBreakdown & { cost: number }> = [];
    for (const item of params.items) {
      // If product has batches, resolve FEFO (earliest expiry first)
      if (item.productId && !item.batchId) {
        const fefoResult = await client.query<{ batch_id: number; available: string }>(
          `SELECT b.id AS batch_id, COALESCE(SUM(sm.quantity), 0)::text AS available
           FROM production_batches b
           LEFT JOIN stock_movements sm ON sm.product_id = b.product_id AND sm.batch_id = b.id
           WHERE b.product_id = $1 AND b.status IN ('completed','closed')
           GROUP BY b.id, b.expiry_date
           HAVING COALESCE(SUM(sm.quantity), 0) >= $2
           ORDER BY b.expiry_date ASC NULLS LAST
           LIMIT 1`,
          [item.productId, item.quantity]
        );
        if (fefoResult.rowCount === 0 && settings.stock_block_zero) {
          throw new ApiError(409, `Insufficient stock for ${item.name}`);
        }
        if (fefoResult.rowCount) {
          item.batchId = fefoResult.rows[0].batch_id;
        }
      }

      // Validate discount within role limit
      if (item.discountAmount && item.discountAmount > 0) {
        if (cashierDiscountLimit > 0 && item.discountAmount > cashierDiscountLimit && cashier.role === Role.Cashier) {
          throw new ApiError(403, `Discount exceeds your limit of ${cashierDiscountLimit} per item`);
        }
      }

      const tax = calculateLineTax(item, settings.tax_inclusive);

      // Get cost for profit calculation
      let cost = 0;
      if (item.productId) {
        const costResult = await client.query<{ cost_price: string }>(
          'SELECT cost_price::text FROM products WHERE id = $1',
          [item.productId]
        );
        if (costResult.rowCount) {
          cost = parseFloat(costResult.rows[0].cost_price) * item.quantity;
        }
      }

      lineItems.push({ ...item, ...tax, cost: round2(cost) });
    }

    // Calculate totals
    const subtotal = round2(lineItems.reduce((s, li) => s + li.taxableValue, 0));
    const totalDiscount = round2(lineItems.reduce((s, li) => s + li.discountAmount, 0));
    const totalCgst = round2(lineItems.reduce((s, li) => s + li.cgst, 0));
    const totalSgst = round2(lineItems.reduce((s, li) => s + li.sgst, 0));
    const preRoundTotal = subtotal + totalCgst + totalSgst;
    const roundOff = round2(Math.round(preRoundTotal) - preRoundTotal);
    const grandTotal = round2(preRoundTotal + roundOff);

    // Generate invoice number
    const { number, finYear } = await nextInvoiceNumber(client);

    // Insert bill
    const billResult = await client.query<{ id: number }>(
      `INSERT INTO bills (invoice_number, fin_year, bill_date, status, customer_id, customer_name,
                         customer_phone, cashier_id, shift_id, subtotal, total_discount,
                         total_cgst, total_sgst, total_igst, round_off, grand_total,
                         amount_in_words, notes, print_count, created_at, updated_at)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $13, $14, $15, $16, 0, NOW(), NOW())
       RETURNING id`,
      [
        number, finYear, BillStatus.Paid, params.customerId ?? null, params.customerName ?? null,
        params.customerPhone ?? null, params.cashierId, params.shiftId ?? null,
        subtotal, totalDiscount, totalCgst, totalSgst, roundOff, grandTotal,
        numberToWords(grandTotal), params.notes ?? null,
      ]
    );
    const billId = billResult.rows[0].id;

    // Insert bill items
    for (const li of lineItems) {
      await client.query(
        `INSERT INTO bill_items (bill_id, product_id, variant_id, combo_id, batch_id, item_name,
                                hsn_code, quantity, unit, rate, base_amount, discount_amount,
                                taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount,
                                total_amount, line_cost, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 0, $17, $18, $19, NOW())`,
        [
          billId, li.productId ?? null, li.variantId ?? null, li.comboId ?? null, li.batchId ?? null,
          li.name, li.hsnCode ?? null, li.quantity, li.unit, li.rate, li.baseAmount, li.discountAmount,
          li.taxableValue, li.gstRate, li.cgst, li.sgst, li.total, li.cost, li.notes ?? null,
        ]
      );

      // Deduct stock via stock ledger (PRD 5.6)
      if (li.productId) {
        await client.query(
          `INSERT INTO stock_movements (product_id, batch_id, movement_type, quantity, unit,
                                         reference_type, reference_id, created_by, created_at)
           VALUES ($1, $2, 'sale', $3, $4, 'bill', $5, $6, NOW())`,
          [li.productId, li.batchId ?? null, -li.quantity, li.unit, billId, params.cashierId]
        );
      }
    }

    // Insert payments
    for (const p of params.payments) {
      await client.query(
        `INSERT INTO payments (bill_id, payment_mode, amount, reference_no, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [billId, p.paymentMode, p.amount, p.referenceNo ?? null]
      );
    }

    // Verify payment sum matches grand total
    const paySum = round2(params.payments.reduce((s, p) => s + p.amount, 0));
    if (Math.abs(paySum - grandTotal) > 0.02) {
      throw new ApiError(400, `Payment total (${paySum}) does not match grand total (${grandTotal})`);
    }

    // Loyalty points (if enabled and customer attached)
    if (params.customerId) {
      const loyaltyResult = await client.query<{ loyalty_enabled: boolean; points_per_rupee: string }>(
        'SELECT loyalty_enabled, loyalty_points_per_rupee::text FROM settings WHERE id = 1'
      );
      const loyalty = loyaltyResult.rows[0];
      if (loyalty.loyalty_enabled) {
        const points = Math.floor(grandTotal * parseFloat(loyalty.points_per_rupee));
        if (points > 0) {
          await client.query(
            'UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2',
            [points, params.customerId]
          );
          await client.query(
            `INSERT INTO loyalty_transactions (customer_id, type, points, bill_id, balance_after, created_at)
             VALUES ($1, 'earn', $2, $3, 0, NOW())`,
            [params.customerId, points, billId]
          );
        }
      }
    }

    await auditLog({
      userId: params.cashierId,
      action: AuditAction.Create,
      entity: 'bill',
      entityId: billId,
      after: { invoiceNumber: number, grandTotal },
      req: params.req,
    });

    return { billId, invoiceNumber: number, finYear, grandTotal };
  });
}

// ─── Hold / Resume Bills ──────────────────────────────────

export async function holdBill(params: {
  items: BillItemInput[];
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  cashierId: number;
  req: Request;
}) {
  return withTransaction(async (client) => {
    const { number, finYear } = await nextInvoiceNumber(client);
    const subtotal = round2(params.items.reduce((s, i) => s + i.quantity * i.rate, 0));

    const billResult = await client.query<{ id: number }>(
      `INSERT INTO bills (invoice_number, fin_year, bill_date, status, customer_id, customer_name,
                         customer_phone, cashier_id, subtotal, grand_total, held_at, created_at, updated_at)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, 0, NOW(), NOW(), NOW()) RETURNING id`,
      [number, finYear, BillStatus.Held, params.customerId ?? null, params.customerName ?? null,
       params.customerPhone ?? null, params.cashierId, subtotal]
    );
    const billId = billResult.rows[0].id;

    for (const item of params.items) {
      await client.query(
        `INSERT INTO bill_items (bill_id, product_id, variant_id, combo_id, item_name, hsn_code,
                                quantity, unit, rate, base_amount, taxable_value, gst_rate, total_amount, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $10, NOW())`,
        [billId, item.productId ?? null, item.variantId ?? null, item.comboId ?? null,
         item.name, item.hsnCode ?? null, item.quantity, item.unit, item.rate,
         item.quantity * item.rate, item.gstRate]
      );
    }

    return { billId, invoiceNumber: number };
  });
}

export async function resumeBill(billId: number) {
  const result = await query(
    `SELECT b.id, b.invoice_number, b.status, b.customer_id, b.customer_name, b.customer_phone,
            b.notes,
            json_agg(json_build_object(
              'id', bi.id, 'productId', bi.product_id, 'variantId', bi.variant_id,
              'comboId', bi.combo_id, 'name', bi.item_name, 'hsnCode', bi.hsn_code,
              'quantity', bi.quantity, 'unit', bi.unit, 'rate', bi.rate::text,
              'gstRate', bi.gst_rate::text
            )) AS items
     FROM bills b
     LEFT JOIN bill_items bi ON bi.bill_id = b.id
     WHERE b.id = $1 AND b.status = 'held'
     GROUP BY b.id`,
    [billId]
  );
  if (result.rowCount === 0) throw new ApiError(404, 'Held bill not found');
  return result.rows[0];
}

// ─── List / Get Bills ────────────────────────────────────

export async function listBills(filters: {
  dateFrom?: string;
  dateTo?: string;
  status?: BillStatus;
  cashierId?: number;
  customerId?: number;
  page?: number;
  limit?: number;
} = {}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const offset = (page - 1) * limit;

  let sql = `SELECT b.id, b.invoice_number, b.bill_date, b.status, b.grand_total::text,
                    b.customer_name, b.customer_phone, u.display_name AS cashier_name,
                    b.print_count
             FROM bills b
             JOIN users u ON u.id = b.cashier_id
             WHERE 1=1`;
  const values: unknown[] = [];
  let idx = 1;

  if (filters.dateFrom) {
    sql += ` AND b.bill_date >= $${idx++}`;
    values.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += ` AND b.bill_date <= $${idx++}`;
    values.push(filters.dateTo + ' 23:59:59');
  }
  if (filters.status) {
    sql += ` AND b.status = $${idx++}`;
    values.push(filters.status);
  }
  if (filters.cashierId) {
    sql += ` AND b.cashier_id = $${idx++}`;
    values.push(filters.cashierId);
  }
  if (filters.customerId) {
    sql += ` AND b.customer_id = $${idx++}`;
    values.push(filters.customerId);
  }

  sql += ` ORDER BY b.bill_date DESC LIMIT $${idx++} OFFSET $${idx++}`;
  values.push(limit, offset);

  const result = await query(sql, values);
  return result.rows.map((r) => ({ ...r, grandTotal: parseFloat(r.grand_total) }));
}

export async function getBillById(id: number) {
  const billResult = await query(
    `SELECT b.id, b.invoice_number, b.fin_year, b.bill_date, b.status, b.subtotal::text,
            b.total_discount::text, b.total_cgst::text, b.total_sgst::text, b.round_off::text,
            b.grand_total::text, b.amount_in_words, b.notes, b.print_count, b.cancel_reason,
            b.customer_id, b.customer_name, b.customer_phone, b.cashier_id,
            u.display_name AS cashier_name, b.shift_id, b.created_at,
            (SELECT json_agg(json_build_object(
              'id', bi.id, 'productId', bi.product_id, 'variantId', bi.variant_id,
              'comboId', bi.combo_id, 'batchId', bi.batch_id, 'name', bi.item_name,
              'hsnCode', bi.hsn_code, 'quantity', bi.quantity, 'unit', bi.unit,
              'rate', bi.rate::text, 'baseAmount', bi.base_amount::text,
              'discountAmount', bi.discount_amount::text, 'taxableValue', bi.taxable_value::text,
              'gstRate', bi.gst_rate::text, 'cgst', bi.cgst_amount::text, 'sgst', bi.sgst_amount::text,
              'totalAmount', bi.total_amount::text, 'lineCost', bi.line_cost::text, 'notes', bi.notes
            )) FROM bill_items bi WHERE bi.bill_id = b.id) AS items,
            (SELECT json_agg(json_build_object(
              'id', p.id, 'paymentMode', p.payment_mode, 'amount', p.amount::text, 'referenceNo', p.reference_no
            )) FROM payments p WHERE p.bill_id = b.id) AS payments
     FROM bills b
     JOIN users u ON u.id = b.cashier_id
     WHERE b.id = $1`,
    [id]
  );
  if (billResult.rowCount === 0) throw new ApiError(404, 'Bill not found');
  const bill = billResult.rows[0];
  return {
    ...bill,
    subtotal: parseFloat(bill.subtotal),
    totalDiscount: parseFloat(bill.total_discount),
    totalCgst: parseFloat(bill.total_cgst),
    totalSgst: parseFloat(bill.total_sgst),
    roundOff: parseFloat(bill.round_off),
    grandTotal: parseFloat(bill.grand_total),
    items: (bill.items ?? []).map((i: Record<string, string>) => ({
      ...i,
      rate: parseFloat(i.rate),
      baseAmount: parseFloat(i.base_amount),
      discountAmount: parseFloat(i.discount_amount),
      taxableValue: parseFloat(i.taxable_value),
      gstRate: parseFloat(i.gst_rate),
      cgst: parseFloat(i.cgst),
      sgst: parseFloat(i.sgst),
      totalAmount: parseFloat(i.total_amount),
      lineCost: parseFloat(i.line_cost),
    })),
    payments: (bill.payments ?? []).map((p: Record<string, string>) => ({
      ...p,
      amount: parseFloat(p.amount),
    })),
  };
}

// ─── Cancel Bill ─────────────────────────────────────────

export async function cancelBill(params: {
  billId: number;
  reason: string;
  cancelledBy: number;
  approvedBy: number;
  req: Request;
}) {
  return withTransaction(async (client) => {
    const billResult = await client.query<{ status: string }>(
      'SELECT status FROM bills WHERE id = $1',
      [params.billId]
    );
    if (billResult.rowCount === 0) throw new ApiError(404, 'Bill not found');
    if (billResult.rows[0].status === BillStatus.Cancelled) {
      throw new ApiError(400, 'Bill is already cancelled');
    }

    await client.query(
      `UPDATE bills SET status = $1, cancel_reason = $2, cancelled_by = $3,
                       cancelled_at = NOW(), cancel_approved_by = $4, updated_at = NOW()
       WHERE id = $5`,
      [BillStatus.Cancelled, params.reason, params.cancelledBy, params.approvedBy, params.billId]
    );

    // Reverse stock movements
    const items = await client.query(
      `SELECT product_id, batch_id, quantity, unit FROM bill_items WHERE bill_id = $1 AND product_id IS NOT NULL`,
      [params.billId]
    );
    for (const item of items.rows) {
      await client.query(
        `INSERT INTO stock_movements (product_id, batch_id, movement_type, quantity, unit,
                                       reference_type, reference_id, created_by, created_at)
         VALUES ($1, $2, 'adjustment', $3, $4, 'bill_cancel', $5, $6, NOW())`,
        [item.product_id, item.batch_id, item.quantity, item.unit, params.billId, params.cancelledBy]
      );
    }

    await auditLog({
      userId: params.cancelledBy,
      action: AuditAction.Cancel,
      entity: 'bill',
      entityId: params.billId,
      after: { reason: params.reason },
      req: params.req,
    });
  });
}

// ─── Print Tracking ──────────────────────────────────────

export async function recordPrint(billId: number) {
  await query('UPDATE bills SET print_count = print_count + 1 WHERE id = $1', [billId]);
  const result = await query<{ print_count: string }>(
    'SELECT print_count::text FROM bills WHERE id = $1',
    [billId]
  );
  return { printCount: parseInt(result.rows[0].print_count, 10), isDuplicate: parseInt(result.rows[0].print_count, 10) > 1 };
}
