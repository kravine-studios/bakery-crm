import { query } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─── Sales Reports ───────────────────────────────────────

export async function getSalesSummary(dateFrom: string, dateTo: string) {
  const result = await query(
    `SELECT
       COUNT(*) AS bill_count,
       COALESCE(SUM(subtotal), 0)::text AS total_sales,
       COALESCE(SUM(total_discount), 0)::text AS total_discounts,
       COALESCE(SUM(total_cgst + total_sgst), 0)::text AS total_gst,
       COALESCE(SUM(grand_total), 0)::text AS total_revenue
     FROM bills
     WHERE bill_date >= $1 AND bill_date <= $2 AND status != 'cancelled'`,
    [dateFrom, dateTo + ' 23:59:59']
  );
  const r = result.rows[0];
  return {
    billCount: parseInt(r.bill_count, 10),
    totalSales: parseFloat(r.total_sales),
    totalDiscounts: parseFloat(r.total_discounts),
    totalGst: parseFloat(r.total_gst),
    totalRevenue: parseFloat(r.total_revenue),
  };
}

export async function getSalesByProduct(dateFrom: string, dateTo: string) {
  const result = await query(
    `SELECT bi.item_name, p.name AS product_name,
            SUM(bi.quantity)::text AS total_qty,
            SUM(bi.total_amount)::text AS total_amount,
            SUM(bi.line_cost)::text AS total_cost,
            SUM(bi.total_amount - bi.line_cost)::text AS total_profit,
            COUNT(*) AS times_sold
     FROM bill_items bi
     JOIN bills b ON b.id = bi.bill_id
     LEFT JOIN products p ON p.id = bi.product_id
     WHERE b.bill_date >= $1 AND b.bill_date <= $2 AND b.status != 'cancelled'
     GROUP BY bi.item_name, p.name
     ORDER BY total_amount DESC`,
    [dateFrom, dateTo + ' 23:59:59']
  );
  return result.rows.map((r) => ({
    ...r,
    totalQty: parseFloat(r.total_qty),
    totalAmount: parseFloat(r.total_amount),
    totalCost: parseFloat(r.total_cost),
    totalProfit: parseFloat(r.total_profit),
  }));
}

export async function getSalesByPaymentMode(dateFrom: string, dateTo: string) {
  const result = await query(
    `SELECT p.payment_mode, SUM(p.amount)::text AS total, COUNT(*) AS count
     FROM payments p JOIN bills b ON b.id = p.bill_id
     WHERE b.bill_date >= $1 AND b.bill_date <= $2 AND b.status != 'cancelled'
     GROUP BY p.payment_mode ORDER BY total DESC`,
    [dateFrom, dateTo + ' 23:59:59']
  );
  return result.rows.map((r) => ({ ...r, total: parseFloat(r.total) }));
}

export async function getSalesByCashier(dateFrom: string, dateTo: string) {
  const result = await query(
    `SELECT b.cashier_id, u.display_name AS cashier_name,
            COUNT(*) AS bill_count, SUM(b.grand_total)::text AS total_sales,
            SUM(b.total_discount)::text AS total_discounts
     FROM bills b JOIN users u ON u.id = b.cashier_id
     WHERE b.bill_date >= $1 AND b.bill_date <= $2 AND b.status != 'cancelled'
     GROUP BY b.cashier_id, u.display_name ORDER BY total_sales DESC`,
    [dateFrom, dateTo + ' 23:59:59']
  );
  return result.rows.map((r) => ({
    ...r, totalSales: parseFloat(r.total_sales), totalDiscounts: parseFloat(r.total_discounts),
  }));
}

export async function getSalesByHour(dateFrom: string, dateTo: string) {
  const result = await query(
    `SELECT EXTRACT(HOUR FROM b.bill_date)::int AS hour,
            COUNT(*) AS bill_count, SUM(b.grand_total)::text AS total_sales
     FROM bills b
     WHERE b.bill_date >= $1 AND b.bill_date <= $2 AND b.status != 'cancelled'
     GROUP BY hour ORDER BY hour`,
    [dateFrom, dateTo + ' 23:59:59']
  );
  return result.rows.map((r) => ({ ...r, totalSales: parseFloat(r.total_sales) }));
}

// ─── Inventory Reports ────────────────────────────────────

export async function getStockValuation() {
  const result = await query(
    `SELECT p.id, p.name,
            COALESCE(SUM(sm.quantity), 0)::text AS total_qty,
            p.cost_price::text AS cost_price,
            p.selling_price::text AS selling_price,
            (COALESCE(SUM(sm.quantity), 0) * p.cost_price)::text AS stock_value_cost,
            (COALESCE(SUM(sm.quantity), 0) * p.selling_price)::text AS stock_value_retail
     FROM products p
     LEFT JOIN stock_movements sm ON sm.product_id = p.id
     WHERE p.is_active = TRUE
     GROUP BY p.id, p.name, p.cost_price, p.selling_price
     HAVING COALESCE(SUM(sm.quantity), 0) > 0
     ORDER BY stock_value_cost DESC`
  );
  return result.rows.map((r) => ({
    ...r,
    totalQty: parseFloat(r.total_qty),
    costPrice: parseFloat(r.cost_price),
    sellingPrice: parseFloat(r.selling_price),
    stockValueCost: parseFloat(r.stock_value_cost),
    stockValueRetail: parseFloat(r.stock_value_retail),
  }));
}

// ─── GST Report ──────────────────────────────────────────

export async function getGstReport(dateFrom: string, dateTo: string) {
  // Output tax collected by rate
  const outputTax = await query(
    `SELECT bi.gst_rate::text AS gst_rate,
            SUM(bi.taxable_value)::text AS taxable_value,
            SUM(bi.cgst_amount)::text AS cgst,
            SUM(bi.sgst_amount)::text AS sgst,
            SUM(bi.cgst_amount + bi.sgst_amount)::text AS total_tax
     FROM bill_items bi
     JOIN bills b ON b.id = bi.bill_id
     WHERE b.bill_date >= $1 AND b.bill_date <= $2 AND b.status != 'cancelled'
     GROUP BY bi.gst_rate ORDER BY bi.gst_rate`,
    [dateFrom, dateTo + ' 23:59:59']
  );

  // Input tax on purchases
  const inputTax = await query(
    `SELECT pi.gst_rate::text AS gst_rate,
            SUM(pi.line_amount)::text AS taxable_value,
            SUM(pi.line_gst)::text AS input_tax
     FROM purchase_items pi
     JOIN purchase_receipts pr ON pr.id = pi.receipt_id
     WHERE pr.receipt_date >= $1 AND pr.receipt_date <= $2
     GROUP BY pi.gst_rate ORDER BY pi.gst_rate`,
    [dateFrom, dateTo + ' 23:59:59']
  );

  return {
    outputTax: outputTax.rows.map((r) => ({
      ...r,
      gstRate: parseFloat(r.gst_rate),
      taxableValue: parseFloat(r.taxable_value),
      cgst: parseFloat(r.cgst),
      sgst: parseFloat(r.sgst),
      totalTax: parseFloat(r.total_tax),
    })),
    inputTax: inputTax.rows.map((r) => ({
      ...r,
      gstRate: parseFloat(r.gst_rate),
      taxableValue: parseFloat(r.taxable_value),
      inputTax: parseFloat(r.input_tax),
    })),
  };
}

// ─── Wastage Report ──────────────────────────────────────

export async function getWastageReport(dateFrom: string, dateTo: string) {
  const result = await query(
    `SELECT w.reason, p.name AS product_name, w.batch_id, b.batch_number,
            w.quantity::text, w.unit, w.cost_value::text,
            u.display_name AS approved_by_name, w.created_at
     FROM wastage_records w
     JOIN products p ON p.id = w.product_id
     LEFT JOIN production_batches b ON b.id = w.batch_id
     JOIN users u ON u.id = w.approved_by
     WHERE w.created_at >= $1 AND w.created_at <= $2
     ORDER BY w.created_at DESC`,
    [dateFrom, dateTo + ' 23:59:59']
  );
  return result.rows.map((r) => ({
    ...r, quantity: parseFloat(r.quantity), costValue: parseFloat(r.cost_value),
  }));
}

// ─── Production Report ────────────────────────────────────

export async function getProductionReport(dateFrom: string, dateTo: string) {
  const result = await query(
    `SELECT b.id, b.batch_number, p.name AS product_name,
            b.planned_quantity::text, b.actual_quantity::text, b.unit,
            b.production_cost::text, b.cost_per_unit::text,
            (b.actual_quantity - b.planned_quantity)::text AS loss_qty,
            u.display_name AS supervisor_name, b.production_date, b.status
     FROM production_batches b
     JOIN products p ON p.id = b.product_id
     JOIN users u ON u.id = b.supervised_by
     WHERE b.production_date >= $1 AND b.production_date <= $2
     ORDER BY b.production_date DESC`,
    [dateFrom, dateTo + ' 23:59:59']
  );
  return result.rows.map((r) => ({
    ...r,
    plannedQuantity: parseFloat(r.planned_quantity),
    actualQuantity: r.actual_quantity ? parseFloat(r.actual_quantity) : null,
    productionCost: parseFloat(r.production_cost),
    costPerUnit: parseFloat(r.cost_per_unit),
    lossQty: r.loss_qty ? parseFloat(r.loss_qty) : null,
  }));
}

// ─── Profit Report ────────────────────────────────────────

export async function getProfitReport(dateFrom: string, dateTo: string) {
  const sales = await getSalesSummary(dateFrom, dateTo);
  const expensesResult = await query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS total FROM expenses WHERE expense_date >= $1 AND expense_date <= $2`,
    [dateFrom, dateTo + ' 23:59:59']
  );
  const totalExpenses = parseFloat(expensesResult.rows[0].total);

  // COGS from bill items
  const cogsResult = await query<{ total: string }>(
    `SELECT COALESCE(SUM(bi.line_cost), 0)::text AS total
     FROM bill_items bi JOIN bills b ON b.id = bi.bill_id
     WHERE b.bill_date >= $1 AND b.bill_date <= $2 AND b.status != 'cancelled'`,
    [dateFrom, dateTo + ' 23:59:59']
  );
  const totalCogs = parseFloat(cogsResult.rows[0].total);

  const grossProfit = round2(sales.totalRevenue - totalCogs);
  const netProfit = round2(grossProfit - totalExpenses);

  return {
    totalRevenue: sales.totalRevenue,
    totalCogs,
    grossProfit,
    totalExpenses,
    netProfit,
    grossMargin: round2(grossProfit / (sales.totalRevenue || 1) * 100),
    netMargin: round2(netProfit / (sales.totalRevenue || 1) * 100),
  };
}
