-- 008_purchases.sql
-- Purchase orders, purchase receipts (GRN), purchase items, supplier payments (PRD 5.4).

-- Optional purchase orders raised to a supplier (PRD 5.4)
CREATE TABLE purchase_orders (
    id              SERIAL PRIMARY KEY,
    po_number       TEXT NOT NULL UNIQUE,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    order_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_date    DATE,
    status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','partially_received','received','cancelled')),
    notes            TEXT,
    created_by       INTEGER NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON purchase_orders(status);

-- GRN (goods received note) — purchase receipt (PRD 5.4)
CREATE TABLE purchase_receipts (
    id              SERIAL PRIMARY KEY,
    grn_number      TEXT NOT NULL UNIQUE,
    po_id           INTEGER REFERENCES purchase_orders(id),  -- nullable: can receive without a PO
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    supplier_invoice_no TEXT,
    supplier_invoice_date DATE,
    receipt_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_gst       NUMERIC(14,2) NOT NULL DEFAULT 0,
    grand_total     NUMERIC(14,2) NOT NULL DEFAULT 0,
    notes           TEXT,
    received_by     INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grn_supplier ON purchase_receipts(supplier_id);
CREATE INDEX idx_grn_date ON purchase_receipts(receipt_date);

-- Line items in a GRN (PRD 5.4)
CREATE TABLE purchase_items (
    id              SERIAL PRIMARY KEY,
    receipt_id      INTEGER NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
    po_id           INTEGER REFERENCES purchase_orders(id),
    raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id),
    quantity_ordered NUMERIC(14,3) DEFAULT 0,
    quantity_received NUMERIC(14,3) NOT NULL DEFAULT 0,
    quantity_rejected NUMERIC(14,3) NOT NULL DEFAULT 0,  -- quality check reject (5.4)
    reject_reason   TEXT,
    unit            TEXT NOT NULL,
    rate             NUMERIC(12,2) NOT NULL,            -- rate per unit (excl GST)
    gst_rate         NUMERIC(5,2) NOT NULL DEFAULT 0,
    line_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,  -- qty * rate
    line_gst         NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_items_receipt ON purchase_items(receipt_id);
CREATE INDEX idx_purchase_items_material ON purchase_items(raw_material_id);

-- Raw material lots: each received batch with expiry and supplier lot (PRD 5.4)
-- Supports FIFO costing and expiry tracking.
CREATE TABLE raw_material_lots (
    id              SERIAL PRIMARY KEY,
    receipt_item_id INTEGER NOT NULL REFERENCES purchase_items(id),
    raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id),
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    supplier_lot_no TEXT,                     -- supplier batch/lot number (5.4)
    quantity_received NUMERIC(14,3) NOT NULL,
    quantity_remaining NUMERIC(14,3) NOT NULL,  -- decremented as consumed in production
    unit            TEXT NOT NULL,
    rate             NUMERIC(12,2) NOT NULL,   -- per-unit cost for costing
    gst_rate         NUMERIC(5,2) NOT NULL DEFAULT 0,
    expiry_date      DATE,                     -- perishable expiry (5.4)
    received_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lots_material ON raw_material_lots(raw_material_id);
CREATE INDEX idx_lots_expiry ON raw_material_lots(expiry_date);
CREATE INDEX idx_lots_remaining ON raw_material_lots(quantity_remaining);
