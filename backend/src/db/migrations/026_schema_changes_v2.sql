-- 026_schema_changes_v2.sql
-- All schema changes for the v2 feature set.
-- Additive only — no existing columns are dropped (only nullified or defaulted).
-- Old data is preserved; dropped UI fields are hidden in queries, not in the DB.
-- Run this AFTER backing up the database.
-- Reversible: see the ROLLBACK section at the bottom (commented out).

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ORDERS — drop status (keep column for historical data, just not surfaced)
--    We do NOT drop the column so old data is safe.
--    The UI simply stops sending/showing it.
-- ────────────────────────────────────────────────────────────────────────────
-- Nothing to migrate; column stays, UI removes it.

-- ────────────────────────────────────────────────────────────────────────────
-- 2. USERS — discount_limit kept but hidden from UI
--    (column stays for DB compatibility, UI drops it)
-- ────────────────────────────────────────────────────────────────────────────
-- Nothing to migrate; UI removes the column.

-- ────────────────────────────────────────────────────────────────────────────
-- 3. PRODUCTS — GST and Unit become optional; add low_stock_level, Code already
--    exists from migration 024_product_code.sql
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE products
  ALTER COLUMN gst_rate    DROP NOT NULL,
  ALTER COLUMN gst_rate    SET DEFAULT NULL,
  ALTER COLUMN selling_unit DROP NOT NULL,
  ALTER COLUMN selling_unit SET DEFAULT NULL;

-- Set existing zero-GST products to explicit NULL so receipts skip the tax line
UPDATE products SET gst_rate = NULL WHERE gst_rate = 0;

-- Set 'piece' unit explicitly where it was the default so existing data is valid
-- (unit is already set, so no data loss)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS low_stock_level NUMERIC(14,3) DEFAULT NULL;

COMMENT ON COLUMN products.low_stock_level IS
  'Counter quantity at which Billing shows a Low warning. NULL = no warning.';

-- Remove the NOT NULL constraint on selling_unit entirely
-- (some DBs need DROP CONSTRAINT; for CHECK we need to recreate it)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_selling_unit_check;
ALTER TABLE products
  ADD CONSTRAINT products_selling_unit_check
  CHECK (selling_unit IS NULL OR selling_unit IN ('piece','kg','gram','box','dozen','litre','ml','packet'));

-- ────────────────────────────────────────────────────────────────────────────
-- 4. SUPPLIERS — opening_balance kept but hidden; add supplier_products table
-- ────────────────────────────────────────────────────────────────────────────
-- opening_balance stays; UI removes it.

-- New table: items a supplier supplies (can reference raw_materials or products,
-- or be a free-text item name)
CREATE TABLE IF NOT EXISTS supplier_products (
    id              SERIAL PRIMARY KEY,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    -- Either a raw material FK, or a product FK, or a free-text name:
    raw_material_id INTEGER REFERENCES raw_materials(id),
    product_id      INTEGER REFERENCES products(id),
    item_name       TEXT,          -- free-text if not linked
    usual_rate      NUMERIC(12,2), -- optional usual rate
    unit            TEXT,          -- optional unit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (raw_material_id IS NOT NULL)::int
      + (product_id IS NOT NULL)::int
      + (item_name IS NOT NULL)::int
      = 1  -- exactly one must be set
    )
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_rm      ON supplier_products(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_product ON supplier_products(product_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. PURCHASES — rename GRN → Bill No.; add payment status fields
-- ────────────────────────────────────────────────────────────────────────────

-- Add bill_number column (migrate grn_number values into it)
ALTER TABLE purchase_receipts
  ADD COLUMN IF NOT EXISTS bill_number TEXT;

-- Migrate existing GRN numbers to bill_number
UPDATE purchase_receipts
  SET bill_number = grn_number
  WHERE bill_number IS NULL;

-- Make bill_number NOT NULL and unique (grn_number stays for rollback)
ALTER TABLE purchase_receipts
  ALTER COLUMN bill_number SET NOT NULL;

-- Don't add UNIQUE on bill_number globally — uniqueness is per supplier
-- (handled in application code with a CHECK)

CREATE INDEX IF NOT EXISTS idx_purchases_bill_number ON purchase_receipts(bill_number);

-- Payment status fields
ALTER TABLE purchase_receipts
  ADD COLUMN IF NOT EXISTS payment_status TEXT
    NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('paid','partial','unpaid')),
  ADD COLUMN IF NOT EXISTS amount_paid    NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_mode   TEXT,
  ADD COLUMN IF NOT EXISTS payment_date   DATE;

-- Existing receipts: if grand_total > 0 treat as unpaid (safe default)
-- Operators can mark them as paid from the UI.

-- ────────────────────────────────────────────────────────────────────────────
-- 6. PRODUCTION BATCHES — simplify: add produced_quantity, cost_per_unit_selling,
--    selling_price_per_unit. Keep existing columns for data safety.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS produced_quantity    NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS cost_per_kg          NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price_per_unit NUMERIC(12,2);

-- Migrate: produced_quantity = COALESCE(actual_quantity, planned_quantity)
UPDATE production_batches
  SET produced_quantity = COALESCE(actual_quantity, planned_quantity)
  WHERE produced_quantity IS NULL;

-- Migrate: cost_per_kg = cost_per_unit (same field, different name)
UPDATE production_batches
  SET cost_per_kg = COALESCE(cost_per_unit, 0)
  WHERE cost_per_kg = 0;

COMMENT ON COLUMN production_batches.produced_quantity IS
  'How many units (kg, pc, etc.) were actually produced. Migrated from actual_quantity.';

-- ────────────────────────────────────────────────────────────────────────────
-- 7. STOCK MODEL — add store_qty and counter_qty to stock_movements;
--    also add a stock_lots table for per-batch counters
-- ────────────────────────────────────────────────────────────────────────────

-- stock_lots: one row per (product × batch). Tracks store and counter separately.
CREATE TABLE IF NOT EXISTS stock_lots (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    batch_id        INTEGER REFERENCES production_batches(id),  -- NULL for traded
    purchase_receipt_id INTEGER REFERENCES purchase_receipts(id), -- for traded
    lot_label       TEXT,           -- e.g. batch number or Bill No.
    produced_qty    NUMERIC(14,3)   NOT NULL DEFAULT 0,
    store_qty       NUMERIC(14,3)   NOT NULL DEFAULT 0,  -- back stock
    counter_qty     NUMERIC(14,3)   NOT NULL DEFAULT 0,  -- at the counter
    sold_qty        NUMERIC(14,3)   NOT NULL DEFAULT 0,
    wasted_qty      NUMERIC(14,3)   NOT NULL DEFAULT 0,
    adjusted_qty    NUMERIC(14,3)   NOT NULL DEFAULT 0,  -- net adjustments
    expiry_date     DATE,
    production_date TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_lots_product   ON stock_lots(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_lots_batch     ON stock_lots(batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_lots_expiry    ON stock_lots(expiry_date);
CREATE INDEX IF NOT EXISTS idx_stock_lots_counter   ON stock_lots(counter_qty);

-- Back-populate stock_lots from existing stock_movements and production_batches
-- (idempotent: skips batches already seeded)
INSERT INTO stock_lots (product_id, batch_id, lot_label, produced_qty, store_qty, expiry_date, production_date)
SELECT
    pb.product_id,
    pb.id                                             AS batch_id,
    pb.batch_number                                   AS lot_label,
    COALESCE(pb.actual_quantity, pb.planned_quantity) AS produced_qty,
    -- Seed all existing stock into store (counter starts at 0)
    GREATEST(0, COALESCE(
        (SELECT SUM(sm.quantity)
         FROM   stock_movements sm
         WHERE  sm.product_id = pb.product_id
         AND    sm.batch_id   = pb.id),
        COALESCE(pb.actual_quantity, pb.planned_quantity, 0)
    ))                                                AS store_qty,
    pb.expiry_date,
    pb.production_date
FROM production_batches pb
WHERE pb.status IN ('completed','closed')
  AND NOT EXISTS (
    SELECT 1 FROM stock_lots sl
    WHERE sl.batch_id = pb.id
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 8. SETTINGS — add logo_url (for Part 7)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. SHIFTS — add confirm_token for cash count verification (Part 6)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS confirm_token         TEXT,
  ADD COLUMN IF NOT EXISTS confirm_token_expires TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirm_token_action  TEXT;   -- 'open' | 'close'

-- ────────────────────────────────────────────────────────────────────────────
-- 10. SECTION ACCESS — per-user section visibility (Part 6.4)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_section_access (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section     TEXT NOT NULL,
    can_access  BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by  INTEGER REFERENCES users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, section)
);

CREATE INDEX IF NOT EXISTS idx_user_section_access_user ON user_section_access(user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run manually if needed):
--
-- ALTER TABLE products ALTER COLUMN gst_rate SET NOT NULL;
-- ALTER TABLE products ALTER COLUMN gst_rate SET DEFAULT 0;
-- UPDATE products SET gst_rate = 0 WHERE gst_rate IS NULL;
-- ALTER TABLE products ALTER COLUMN selling_unit SET NOT NULL;
-- ALTER TABLE products DROP COLUMN IF EXISTS low_stock_level;
-- DROP TABLE IF EXISTS supplier_products;
-- ALTER TABLE purchase_receipts DROP COLUMN IF EXISTS bill_number;
-- ALTER TABLE purchase_receipts DROP COLUMN IF EXISTS payment_status;
-- ALTER TABLE purchase_receipts DROP COLUMN IF EXISTS amount_paid;
-- ALTER TABLE purchase_receipts DROP COLUMN IF EXISTS payment_mode;
-- ALTER TABLE purchase_receipts DROP COLUMN IF EXISTS payment_date;
-- ALTER TABLE production_batches DROP COLUMN IF EXISTS produced_quantity;
-- ALTER TABLE production_batches DROP COLUMN IF EXISTS cost_per_kg;
-- ALTER TABLE production_batches DROP COLUMN IF EXISTS selling_price_per_unit;
-- DROP TABLE IF EXISTS stock_lots;
-- ALTER TABLE settings DROP COLUMN IF EXISTS logo_url;
-- ALTER TABLE shifts DROP COLUMN IF EXISTS confirm_token;
-- ALTER TABLE shifts DROP COLUMN IF EXISTS confirm_token_expires;
-- ALTER TABLE shifts DROP COLUMN IF EXISTS confirm_token_action;
-- DROP TABLE IF EXISTS user_section_access;
-- ────────────────────────────────────────────────────────────────────────────
