import { query } from '../../config/database';

/**
 * Gather in-app alerts (PRD 5.13):
 * - Low stock
 * - Near-expiry batches
 * - Pending supplier payments
 * - Orders due today
 * - Cash shortage at shift close (checked at shift close)
 */
export async function getAlerts() {
  // Low stock
  const lowStock = await query(
    `SELECT rm.id, rm.name, rm.base_unit, rm.min_stock_level::text, COALESCE(v.current_stock::text, '0') AS current_stock
     FROM raw_materials rm
     LEFT JOIN v_raw_material_stock v ON v.raw_material_id = rm.id
     WHERE rm.is_active = TRUE AND COALESCE(v.current_stock, 0) < rm.min_stock_level
     ORDER BY rm.name ASC`
  );

  // Near-expiry batches (within 7 days)
  const nearExpiry = await query(
    `SELECT p.id AS product_id, p.name AS product_name, b.id AS batch_id, b.batch_number,
            b.expiry_date, COALESCE(SUM(sm.quantity), 0)::text AS stock
     FROM products p
     JOIN production_batches b ON b.product_id = p.id
     LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.batch_id = b.id
     WHERE b.expiry_date IS NOT NULL AND b.expiry_date <= CURRENT_DATE + 7
     GROUP BY p.id, p.name, b.id, b.batch_number, b.expiry_date
     HAVING COALESCE(SUM(sm.quantity), 0) > 0
     ORDER BY b.expiry_date ASC`
  );

  // Pending supplier payments (suppliers with outstanding balance)
  const pendingPayments = await query(
    `SELECT s.id, s.name, s.opening_balance::text AS opening,
            COALESCE((SELECT SUM(grand_total) FROM purchase_receipts WHERE supplier_id = s.id), 0)::text AS purchases,
            COALESCE((SELECT SUM(total_amount) FROM purchase_returns WHERE supplier_id = s.id), 0)::text AS returns,
            COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = s.id), 0)::text AS paid
     FROM suppliers s WHERE s.is_active = TRUE
     HAVING s.opening_balance + COALESCE((SELECT SUM(grand_total) FROM purchase_receipts WHERE supplier_id = s.id), 0)
           - COALESCE((SELECT SUM(total_amount) FROM purchase_returns WHERE supplier_id = s.id), 0)
           - COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = s.id), 0) > 0`
  );

  // Orders due today
  const today = new Date().toISOString().split('T')[0];
  const ordersDue = await query(
    `SELECT id, order_number, customer_id, (SELECT name FROM customers WHERE id = orders.customer_id) AS customer_name,
            pickup_date, delivery_date, status
     FROM orders
     WHERE status IN ('booked', 'in_production', 'ready')
       AND COALESCE(delivery_date, pickup_date) = $1
     ORDER BY id`,
    [today]
  );

  return {
    lowStock: lowStock.rows.map((r) => ({ ...r, minStockLevel: parseFloat(r.min_stock_level), currentStock: parseFloat(r.current_stock) })),
    nearExpiry: nearExpiry.rows.map((r) => ({ ...r, stock: parseFloat(r.stock) })),
    pendingPayments: pendingPayments.rows.map((r) => ({
      ...r, opening: parseFloat(r.opening), purchases: parseFloat(r.purchases),
      returns: parseFloat(r.returns), paid: parseFloat(r.paid),
      outstanding: parseFloat(r.opening) + parseFloat(r.purchases) - parseFloat(r.returns) - parseFloat(r.paid),
    })),
    ordersDue: ordersDue.rows,
  };
}
