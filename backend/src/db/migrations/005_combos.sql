-- 005_combos.sql
-- Combos and gift boxes: a box made of several items sold at one price,
-- stock deducted per component (PRD 5.2).

CREATE TABLE combos (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    price           NUMERIC(12,2) NOT NULL,
    gst_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
    hsn_code        TEXT,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      INTEGER REFERENCES users(id)
);

CREATE INDEX idx_combos_active ON combos(is_active);

-- Combo components: which products/variants and quantities make up the combo
CREATE TABLE combo_items (
    id              SERIAL PRIMARY KEY,
    combo_id        INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    product_id      INTEGER REFERENCES products(id),
    variant_id      INTEGER REFERENCES product_variants(id),
    quantity        NUMERIC(12,3) NOT NULL DEFAULT 1,
    unit            TEXT NOT NULL DEFAULT 'piece',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_combo_items_combo ON combo_items(combo_id);
