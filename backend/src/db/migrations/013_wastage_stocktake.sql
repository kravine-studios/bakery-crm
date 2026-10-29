-- 013_wastage_stocktake.sql
-- Wastage records and stock count/stocktake with variance (PRD 5.6).

-- Wastage and spoilage (PRD 5.6)
CREATE TABLE wastage_records (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    batch_id        INTEGER REFERENCES production_batches(id),
    raw_material_id INTEGER REFERENCES raw_materials(id),  -- raw material wastage
    quantity        NUMERIC(14,3) NOT NULL,
    unit            TEXT NOT NULL,
    cost_value      NUMERIC(14,2) NOT NULL DEFAULT 0,  -- cost of wasted qty
    reason          TEXT NOT NULL CHECK (reason IN
                    ('expired','damaged','sampling','spillage','staff_consumption')),
    notes           TEXT,
    approved_by     INTEGER NOT NULL REFERENCES users(id),
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wastage_product ON wastage_records(product_id);
CREATE INDEX idx_wastage_date ON wastage_records(created_at);
CREATE INDEX idx_wastage_reason ON wastage_records(reason);

-- Physical stock count / stocktake (PRD 5.6)
CREATE TABLE stock_counts (
    id              SERIAL PRIMARY KEY,
    count_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed')),
    notes           TEXT,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual line items in a stocktake
CREATE TABLE stock_count_items (
    id              SERIAL PRIMARY KEY,
    stock_count_id  INTEGER NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    batch_id        INTEGER REFERENCES production_batches(id),
    system_quantity NUMERIC(14,3) NOT NULL,   -- quantity per ledger at count time
    counted_quantity NUMERIC(14,3) NOT NULL,  -- physical counted qty
    variance        NUMERIC(14,3) GENERATED ALWAYS AS (counted_quantity - system_quantity) STORED,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stockcount_items_count ON stock_count_items(stock_count_id);
CREATE INDEX idx_stockcount_items_product ON stock_count_items(product_id, batch_id);
