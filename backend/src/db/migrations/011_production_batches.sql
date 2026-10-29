-- 011_production_batches.sql
-- Production batches and batch material usage (PRD 5.5).
-- Batch number format: MM-YY-NNN (e.g. 03-26-001) — per product per month.

CREATE TABLE production_batches (
    id                  SERIAL PRIMARY KEY,
    batch_number        TEXT NOT NULL,         -- MM-YY-NNN format (generated)
    product_id          INTEGER NOT NULL REFERENCES products(id),
    recipe_id           INTEGER NOT NULL REFERENCES recipes(id),
    planned_quantity    NUMERIC(14,3) NOT NULL,
    actual_quantity      NUMERIC(14,3),        -- filled on completion; gap = production loss
    unit                TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned','in_progress','completed','closed')),
    production_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_date       TIMESTAMPTZ,
    expiry_date          DATE,                 -- calculated from shelf life, editable (5.5)
    supervised_by        INTEGER NOT NULL REFERENCES users(id),  -- staff supervisor (5.5)
    shift_id             INTEGER,              -- production shift reference (5.5)
    production_cost      NUMERIC(14,2) NOT NULL DEFAULT 0,  -- total cost from consumed materials
    cost_per_unit        NUMERIC(12,4) NOT NULL DEFAULT 0,  -- production_cost / actual_quantity
    notes                TEXT,
    created_by           INTEGER NOT NULL REFERENCES users(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(batch_number, product_id)           -- batch_number unique per product
);

CREATE INDEX idx_batches_product ON production_batches(product_id);
CREATE INDEX idx_batches_status ON production_batches(status);
CREATE INDEX idx_batches_date ON production_batches(production_date);
CREATE INDEX idx_batches_supervisor ON production_batches(supervised_by);
CREATE INDEX idx_batches_batch_no ON production_batches(batch_number);

-- Batch material usage: which raw material lots were consumed for a batch (PRD 5.5, 5.6 traceability)
CREATE TABLE batch_material_usage (
    id                  SERIAL PRIMARY KEY,
    batch_id            INTEGER NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
    raw_material_id     INTEGER NOT NULL REFERENCES raw_materials(id),
    lot_id              INTEGER REFERENCES raw_material_lots(id),  -- FIFO lot consumption
    planned_quantity    NUMERIC(14,3) NOT NULL,  -- from recipe
    actual_quantity     NUMERIC(14,3) NOT NULL,  -- editable if actual differed (5.5)
    unit                TEXT NOT NULL,
    rate                NUMERIC(12,2) NOT NULL,   -- lot rate for costing
    line_cost           NUMERIC(14,2) NOT NULL,   -- actual_qty * rate
    variance            NUMERIC(14,3) GENERATED ALWAYS AS (actual_quantity - planned_quantity) STORED,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batch_usage_batch ON batch_material_usage(batch_id);
CREATE INDEX idx_batch_usage_material ON batch_material_usage(raw_material_id);
CREATE INDEX idx_batch_usage_lot ON batch_material_usage(lot_id);

-- Sequence number counter for batch numbering (per product per month)
CREATE TABLE batch_sequence (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    year_month      CHAR(5) NOT NULL,          -- "MM-YY" e.g. "03-26"
    last_seq        INTEGER NOT NULL DEFAULT 0,
    UNIQUE(product_id, year_month)
);
