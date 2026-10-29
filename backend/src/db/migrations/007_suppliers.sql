-- 007_suppliers.sql
-- Supplier master (PRD 5.3): name, contact, GSTIN, items supplied, payment terms.
-- Depends on raw_materials (migration 006).

CREATE TABLE suppliers (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    contact_person  TEXT,
    phone           TEXT,
    email           TEXT,
    address         TEXT,
    city            TEXT,
    state           TEXT,
    gstin           TEXT,
    payment_terms   TEXT,                  -- e.g. "Net 15", "COD"
    rating_notes    TEXT,                  -- quality/delay notes (5.3)
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    opening_balance  NUMERIC(14,2) NOT NULL DEFAULT 0,  -- outstanding at creation
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_active ON suppliers(is_active);

-- Which raw materials this supplier typically supplies
CREATE TABLE supplier_items (
    id              SERIAL PRIMARY KEY,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(supplier_id, raw_material_id)
);

CREATE INDEX idx_supplier_items_supplier ON supplier_items(supplier_id);
