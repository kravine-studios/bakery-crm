-- 012_stock_ledger.sql
-- Stock ledger: immutable movement records (PRD 5.6).
-- Stock quantity is DERIVED from the ledger (PRD 7 key rule), never stored
-- directly except as a cache. All money fields use fixed decimal precision.

-- Finished goods stock movements (per product per batch) — PRD 5.6
CREATE TABLE stock_movements (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    batch_id        INTEGER REFERENCES production_batches(id),  -- nullable for traded items
    movement_type   TEXT NOT NULL CHECK (movement_type IN
                    ('production','sale','return','wastage','adjustment','transfer')),
    quantity        NUMERIC(14,3) NOT NULL,    -- positive = in, negative = out
    unit            TEXT NOT NULL,
    reference_type  TEXT,                      -- 'bill','production_batch','wastage','stocktake'
    reference_id    INTEGER,
    balance_after   NUMERIC(14,3),             -- running balance per product+batch (cache)
    notes           TEXT,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_mov_product ON stock_movements(product_id, batch_id);
CREATE INDEX idx_stock_mov_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_mov_date ON stock_movements(created_at);
CREATE INDEX idx_stock_mov_ref ON stock_movements(reference_type, reference_id);

-- Raw material stock movements (per material per lot) — PRD 5.4/5.6
CREATE TABLE raw_material_movements (
    id              SERIAL PRIMARY KEY,
    raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id),
    lot_id          INTEGER REFERENCES raw_material_lots(id),
    movement_type   TEXT NOT NULL CHECK (movement_type IN
                    ('purchase','production','purchase_return','adjustment','wastage')),
    quantity        NUMERIC(14,3) NOT NULL,    -- positive = in, negative = out
    unit            TEXT NOT NULL,
    reference_type  TEXT,
    reference_id    INTEGER,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rm_mov_material ON raw_material_movements(raw_material_id);
CREATE INDEX idx_rm_mov_lot ON raw_material_movements(lot_id);
CREATE INDEX idx_rm_mov_date ON raw_material_movements(created_at);
