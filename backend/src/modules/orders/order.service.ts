import { query } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction, OrderStatus } from '../../types/enums';
import type { Request } from 'express';

export async function listOrders(filters: { status?: OrderStatus; deliveryDate?: string } = {}) {
  let sql = `SELECT o.id, o.order_number, o.customer_id, c.name AS customer_name, c.phone AS customer_phone,
                    o.order_type, o.delivery_type, o.pickup_date, o.pickup_time, o.delivery_date,
                    o.total_amount::text, o.advance_paid::text, o.balance_due::text, o.status,
                    o.assigned_person, o.customisation_notes, o.created_at
             FROM orders o JOIN customers c ON c.id = o.customer_id
             WHERE 1=1`;
  const values: unknown[] = [];
  let idx = 1;
  if (filters.status) { sql += ` AND o.status = $${idx++}`; values.push(filters.status); }
  if (filters.deliveryDate) { sql += ` AND o.delivery_date = $${idx++}`; values.push(filters.deliveryDate); }
  sql += ` ORDER BY o.created_at DESC`;
  const result = await query(sql, values);
  return result.rows.map((r) => ({
    ...r, totalAmount: parseFloat(r.total_amount), advancePaid: parseFloat(r.advance_paid),
    balanceDue: parseFloat(r.balance_due),
  }));
}

export async function getOrderById(id: number) {
  const orderResult = await query(
    `SELECT o.id, o.order_number, o.customer_id, c.name AS customer_name, c.phone AS customer_phone,
            o.order_type, o.delivery_type, o.pickup_date, o.pickup_time, o.delivery_date,
            o.delivery_address, o.delivery_charge::text, o.total_amount::text, o.advance_paid::text,
            o.balance_due::text, o.status, o.assigned_person, o.customisation_notes, o.final_bill_id,
            o.created_at,
            (SELECT json_agg(json_build_object(
              'id', oi.id, 'productId', oi.product_id, 'variantId', oi.variant_id,
              'itemName', oi.item_name, 'quantity', oi.quantity::text, 'unit', oi.unit,
              'rate', oi.rate::text, 'amount', oi.amount::text, 'notes', oi.notes
            )) FROM order_items oi WHERE oi.order_id = o.id) AS items
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $1`,
    [id]
  );
  if (orderResult.rowCount === 0) throw new ApiError(404, 'Order not found');
  const o = orderResult.rows[0];
  return {
    ...o,
    deliveryCharge: parseFloat(o.delivery_charge),
    totalAmount: parseFloat(o.total_amount),
    advancePaid: parseFloat(o.advance_paid),
    balanceDue: parseFloat(o.balance_due),
    items: (o.items ?? []).map((i: Record<string, string>) => ({
      ...i, quantity: parseFloat(i.quantity), rate: parseFloat(i.rate), amount: parseFloat(i.amount),
    })),
  };
}

export async function createOrder(params: {
  customerId: number; orderType?: string; deliveryType?: string; pickupDate?: string;
  pickupTime?: string; deliveryDate?: string; deliveryAddress?: string; deliveryCharge?: number;
  customisationNotes?: string; advancePaid?: number; assignedPerson?: string;
  items: Array<{ productId?: number; variantId?: number; itemName: string; quantity: number; unit: string; rate: number; notes?: string }>;
  createdBy: number; req: Request;
}) {
  const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
  const totalAmount = params.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const advancePaid = params.advancePaid ?? 0;
  const balanceDue = totalAmount - advancePaid;

  const result = await query<{ id: number }>(
    `INSERT INTO orders (order_number, customer_id, order_type, delivery_type, pickup_date, pickup_time,
                         delivery_date, delivery_address, delivery_charge, total_amount, advance_paid,
                         balance_due, status, customisation_notes, assigned_person, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
     RETURNING id`,
    [orderNumber, params.customerId, params.orderType ?? 'custom', params.deliveryType ?? 'pickup',
     params.pickupDate ?? null, params.pickupTime ?? null, params.deliveryDate ?? null,
     params.deliveryAddress ?? null, params.deliveryCharge ?? 0, totalAmount, advancePaid, balanceDue,
     OrderStatus.Booked, params.customisationNotes ?? null, params.assignedPerson ?? null, params.createdBy]
  );
  const orderId = result.rows[0].id;

  for (const item of params.items) {
    await query(
      `INSERT INTO order_items (order_id, product_id, variant_id, item_name, quantity, unit, rate, amount, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [orderId, item.productId ?? null, item.variantId ?? null, item.itemName, item.quantity,
       item.unit, item.rate, item.quantity * item.rate, item.notes ?? null]
    );
  }

  await auditLog({ userId: params.createdBy, action: AuditAction.Create, entity: 'order', entityId: orderId, after: { orderNumber, totalAmount }, req: params.req });
  return { orderId, orderNumber, totalAmount, balanceDue };
}

export async function updateOrderStatus(params: {
  orderId: number; status: OrderStatus; updatedBy: number; req: Request;
}) {
  await query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [params.status, params.orderId]);
  await auditLog({ userId: params.updatedBy, action: AuditAction.Update, entity: 'order', entityId: params.orderId, after: { status: params.status }, req: params.req });
  return { orderId: params.orderId, status: params.status };
}

export async function getDailyProductionSheet(date?: string) {
  // Orders due on the given date that are in production (PRD 5.9)
  const targetDate = date ?? new Date().toISOString().split('T')[0];
  const result = await query(
    `SELECT o.id, o.order_number, c.name AS customer_name, o.customisation_notes,
            o.delivery_type, o.delivery_date, o.pickup_date, o.pickup_time,
            oi.item_name, oi.quantity::text, oi.unit, oi.notes
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.status IN ('booked', 'in_production')
       AND COALESCE(o.delivery_date, o.pickup_date) = $1
     ORDER BY o.delivery_type, o.id`,
    [targetDate]
  );
  return result.rows.map((r) => ({ ...r, quantity: parseFloat(r.quantity) }));
}
