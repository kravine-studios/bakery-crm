-- 023_indexes.sql
-- Additional indexes for common query patterns and dashboard performance.

-- Bills by date range (dashboards, sales reports)
CREATE INDEX idx_bills_date_status ON bills(bill_date, status);

-- Bill items by product + date (top/slow movers, profit by product)
CREATE INDEX idx_bill_items_product_bill ON bill_items(product_id, bill_id);

-- Wastage by period + reason (dashboard)
CREATE INDEX idx_wastage_reason_date ON wastage_records(reason, created_at);

-- Production batches by date (production report)
CREATE INDEX idx_batches_date_status ON production_batches(production_date, status);

-- Purchase receipts by date (purchase report)
CREATE INDEX idx_grn_date_supplier ON purchase_receipts(receipt_date, supplier_id);

-- Supplier payments by date
CREATE INDEX idx_supplier_payments_date_supplier ON supplier_payments(payment_date, supplier_id);

-- Expenses by date + category (expense report)
CREATE INDEX idx_expenses_date_category ON expenses(expense_date, category);

-- Orders by delivery date (daily production sheet)
CREATE INDEX idx_orders_delivery_status ON orders(delivery_date, status);

-- Stock movements by product + date (traceability)
CREATE INDEX idx_stock_mov_product_date ON stock_movements(product_id, created_at);
