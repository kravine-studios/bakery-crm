-- 022_views.sql
-- Convenience views for derived stock balances and dashboards.

-- Finished goods current stock per product+batch.
-- Stock quantity is DERIVED from the stock ledger (PRD 7).
CREATE OR REPLACE VIEW v_finished_stock AS
SELECT
    p.id   AS product_id,
    p.name AS product_name,
    b.id   AS batch_id,
    b.batch_number,
    b.expiry_date,
    b.production_date,
    COALESCE(SUM(sm.quantity), 0) AS current_stock,
    sm.unit
FROM products p
LEFT JOIN production_batches b ON b.product_id = p.id
LEFT JOIN stock_movements sm   ON sm.product_id = p.id AND sm.batch_id = b.id
GROUP BY p.id, p.name, b.id, b.batch_number, b.expiry_date, b.production_date, sm.unit;

-- Raw material current stock per material (summed across lots).
CREATE OR REPLACE VIEW v_raw_material_stock AS
SELECT
    rm.id   AS raw_material_id,
    rm.name AS raw_material_name,
    rm.base_unit,
    rm.min_stock_level,
    COALESCE(SUM(lot.quantity_remaining), 0) AS current_stock,
    MIN(lot.expiry_date) AS earliest_expiry
FROM raw_materials rm
LEFT JOIN raw_material_lots lot ON lot.raw_material_id = rm.id
GROUP BY rm.id, rm.name, rm.base_unit, rm.min_stock_level;

-- FEFO batch selection: the oldest/earliest-expiring batch with stock first (PRD 5.6).
CREATE OR REPLACE VIEW v_fefo_stock AS
SELECT
    p.id AS product_id,
    p.name AS product_name,
    b.id AS batch_id,
    b.batch_number,
    b.expiry_date,
    COALESCE(SUM(sm.quantity), 0) AS available_qty,
    sm.unit
FROM products p
JOIN production_batches b ON b.product_id = p.id AND b.status IN ('completed','closed')
LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.batch_id = b.id
GROUP BY p.id, p.name, b.id, b.batch_number, b.expiry_date, sm.unit
HAVING COALESCE(SUM(sm.quantity), 0) > 0
ORDER BY p.id, b.expiry_date ASC NULLS LAST;  -- earliest expiry first
