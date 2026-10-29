import { query, withTransaction } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction } from '../../types/enums';
import type { PoolClient } from 'pg';
import type { Request } from 'express';

// ─── Purchase Receipts (GRN) ──────────────────────────────

interface PurchaseItemInput {
  rawMaterialId: number;
  quantityReceived: number;
  quantityRejected?: number;
  rejectReason?: string;
  unit: string;
  rate: number;
  gstRate: number;
  lotNo?: string;
  expiryDate?: string;
}

interface CreateReceiptParams {
  supplierId: number;
  poId?: number;
  supplierInvoiceNo?: string;
  supplierInvoiceDate?: string;
  items: PurchaseItemInput[];
  notes?: string;
  receivedBy: number;
  req: Request;
}

export async function createReceipt(params: CreateReceiptParams) {
  return withTransaction(async (client) => {
    // Generate GRN number
    const grnResult = await client.query<{ grn_number: string }>(
      `SELECT 'GRN-' || to_char(NOW(), 'YYMMDD') || '-' ||
              LPAD((COALESCE(MAX(
                CAST(SUBSTRING(grn_number FROM 14) AS INTEGER), 0
              ) + 1), 4, '0') AS grn_number
       FROM purchase_receipts WHERE receipt_date::date = CURRENT_DATE`
    );
    const grnNumber = grnResult.rows[0].grn_number;

    let totalAmount = 0, totalGst = 0;

    // Calculate totals first
    const lineItems: Array<PurchaseItemInput & { lineAmount: number; lineGst: number }> = [];
    for (const item of params.items) {
      const qtyAccepted = item.quantityReceived - (item.quantityRejected ?? 0);
      const lineAmount = qtyAccepted * item.rate;
      const lineGst = lineAmount * (item.gstRate / 100);
      totalAmount += lineAmount;
      totalGst += lineGst;
      lineItems.push({ ...item, lineAmount, lineGst });
    }

    const grandTotal = totalAmount + totalGst;

    // Insert GRN header
    const receiptResult = await client.query<{ id: number }>(
      `INSERT INTO purchase_receipts (grn_number, po_id, supplier_id, supplier_invoice_no,
                                      supplier_invoice_date, receipt_date, total_amount,
                                      total_gst, grand_total, notes, received_by, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, NOW()) RETURNING id`,
      [grnNumber, params.poId ?? null, params.supplierId, params.supplierInvoiceNo ?? null,
       params.supplierInvoiceDate ?? null, totalAmount, totalGst, grandTotal,
       params.notes ?? null, params.receivedBy]
    );
    const receiptId = receiptResult.rows[0].id;

    // Insert line items and create lots
    for (const item of lineItems) {
      const itemResult = await client.query<{ id: number }>(
        `INSERT INTO purchase_items (receipt_id, po_id, raw_material_id, quantity_received,
                                     quantity_rejected, reject_reason, unit, rate, gst_rate,
                                     line_amount, line_gst, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING id`,
        [receiptId, params.poId ?? null, item.rawMaterialId, item.quantityReceived,
         item.quantityRejected ?? 0, item.rejectReason ?? null, item.unit, item.rate,
         item.gstRate, item.lineAmount, item.lineGst]
      );
      const itemId = itemResult.rows[0].id;

      // Create raw material lot (accepted quantity only) — PRD 5.4
      const qtyAccepted = item.quantityReceived - (item.quantityRejected ?? 0);
      if (qtyAccepted > 0) {
        await client.query(
          `INSERT INTO raw_material_lots (receipt_item_id, raw_material_id, supplier_id,
                                           supplier_lot_no, quantity_received, quantity_remaining,
                                           unit, rate, gst_rate, expiry_date, received_date, created_at)
           VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [itemId, item.rawMaterialId, params.supplierId, item.lotNo ?? null,
           qtyAccepted, item.unit, item.rate, item.gstRate, item.expiryDate ?? null]
        );

        // Record raw material stock movement (in) — PRD 5.6
        await client.query(
          `INSERT INTO raw_material_movements (raw_material_id, movement_type, quantity, unit,
                                               reference_type, reference_id, created_by, created_at)
           VALUES ($1, 'purchase', $2, $3, 'purchase_receipt', $4, $5, NOW())`,
          [item.rawMaterialId, qtyAccepted, item.unit, receiptId, params.receivedBy]
        );
      }
    }

    await auditLog({
      userId: params.receivedBy,
      action: AuditAction.Create,
      entity: 'purchase_receipt',
      entityId: receiptId,
      after: { grnNumber, supplierId: params.supplierId, grandTotal },
      req: params.req,
    });

    return { receiptId, grnNumber, grandTotal };
  });
}

export async function listReceipts(filters: { supplierId?: number; dateFrom?: string; dateTo?: string } = {}) {
  let sql = `SELECT pr.id, pr.grn_number, pr.supplier_id, s.name AS supplier_name,
                    pr.supplier_invoice_no, pr.receipt_date, pr.grand_total::text,
                    u.display_name AS received_by_name
             FROM purchase_receipts pr
             JOIN suppliers s ON s.id = pr.supplier_id
             JOIN users u ON u.id = pr.received_by
             WHERE 1=1`;
  const values: unknown[] = [];
  let idx = 1;
  if (filters.supplierId) { sql += ` AND pr.supplier_id = $${idx++}`; values.push(filters.supplierId); }
  if (filters.dateFrom) { sql += ` AND pr.receipt_date >= $${idx++}`; values.push(filters.dateFrom); }
  if (filters.dateTo) { sql += ` AND pr.receipt_date <= $${idx++}`; values.push(filters.dateTo + ' 23:59:59'); }
  sql += ` ORDER BY pr.receipt_date DESC`;
  const result = await query(sql, values);
  return result.rows.map((r) => ({ ...r, grandTotal: parseFloat(r.grand_total) }));
}

export async function getReceiptById(id: number) {
  const receipt = await query(
    `SELECT pr.id, pr.grn_number, pr.po_id, pr.supplier_id, s.name AS supplier_name,
            pr.supplier_invoice_no, pr.supplier_invoice_date, pr.receipt_date,
            pr.total_amount::text, pr.total_gst::text, pr.grand_total::text, pr.notes,
            u.display_name AS received_by_name,
            (SELECT json_agg(json_build_object(
              'id', pi.id, 'rawMaterialId', pi.raw_material_id, 'rawMaterialName', rm.name,
              'quantityReceived', pi.quantity_received::text, 'quantityRejected', pi.quantity_rejected::text,
              'rejectReason', pi.reject_reason, 'unit', pi.unit, 'rate', pi.rate::text,
              'gstRate', pi.gst_rate::text, 'lineAmount', pi.line_amount::text, 'lineGst', pi.line_gst::text
            )) FROM purchase_items pi JOIN raw_materials rm ON rm.id = pi.raw_material_id WHERE pi.receipt_id = pr.id) AS items
     FROM purchase_receipts pr
     JOIN suppliers s ON s.id = pr.supplier_id
     JOIN users u ON u.id = pr.received_by
     WHERE pr.id = $1`,
    [id]
  );
  if (receipt.rowCount === 0) throw new ApiError(404, 'Receipt not found');
  const r = receipt.rows[0];
  return {
    ...r,
    totalAmount: parseFloat(r.total_amount),
    totalGst: parseFloat(r.total_gst),
    grandTotal: parseFloat(r.grand_total),
    items: (r.items ?? []).map((i: Record<string, string>) => ({
      ...i,
      quantityReceived: parseFloat(i.quantity_received),
      quantityRejected: parseFloat(i.quantity_rejected),
      rate: parseFloat(i.rate),
      gstRate: parseFloat(i.gst_rate),
      lineAmount: parseFloat(i.line_amount),
      lineGst: parseFloat(i.line_gst),
    })),
  };
}

// ─── Supplier Payments ───────────────────────────────────

export async function createPayment(params: {
  supplierId: number; amount: number; paymentMode: string; referenceNo?: string;
  notes?: string; createdBy: number; req: Request;
}) {
  const result = await query<{ id: number }>(
    `INSERT INTO supplier_payments (supplier_id, payment_date, amount, payment_mode,
                                    reference_no, notes, created_by, created_at)
     VALUES ($1, NOW(), $2, $3, $4, $5, $6, NOW()) RETURNING id`,
    [params.supplierId, params.amount, params.paymentMode, params.referenceNo ?? null,
     params.notes ?? null, params.createdBy]
  );
  await auditLog({
    userId: params.createdBy,
    action: AuditAction.Create,
    entity: 'supplier_payment',
    entityId: result.rows[0].id,
    after: params,
    req: params.req,
  });
  return { paymentId: result.rows[0].id, message: 'Payment recorded' };
}

// ─── Purchase Orders ─────────────────────────────────────

export async function createPurchaseOrder(params: {
  supplierId: number; expectedDate?: string; notes?: string; createdBy: number; req: Request;
}) {
  const poNumber = `PO-${Date.now().toString().slice(-8)}`;
  const result = await query<{ id: number }>(
    `INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_date, status,
                                  notes, created_by, created_at, updated_at)
     VALUES ($1, $2, NOW(), $3, 'open', $4, $5, NOW(), NOW()) RETURNING id`,
    [poNumber, params.supplierId, params.expectedDate ?? null, params.notes ?? null, params.createdBy]
  );
  await auditLog({
    userId: params.createdBy,
    action: AuditAction.Create,
    entity: 'purchase_order',
    entityId: result.rows[0].id,
    after: { poNumber, supplierId: params.supplierId },
    req: params.req,
  });
  return { poId: result.rows[0].id, poNumber };
}
