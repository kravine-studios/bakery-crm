-- 010_recipes.sql
-- Recipes (bill of materials) for produced items (PRD 5.5).
-- A recipe is per product, with raw materials and quantities per standard batch size.

CREATE TABLE recipes (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    name            TEXT NOT NULL,           -- e.g. "Kaju Katli Standard"
    batch_size      NUMERIC(14,3) NOT NULL DEFAULT 1,  -- standard batch size (e.g. 5 kg)
    batch_unit      TEXT NOT NULL,            -- unit of batch size
    expected_yield  NUMERIC(14,3) NOT NULL,   -- expected finished quantity
    yield_unit      TEXT NOT NULL,
    allowed_wastage_pct NUMERIC(5,2) NOT NULL DEFAULT 0,  -- allowed wastage % (5.5)
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    is_default       BOOLEAN NOT NULL DEFAULT FALSE,  -- default recipe for product
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      INTEGER REFERENCES users(id)
);

CREATE INDEX idx_recipes_product ON recipes(product_id);

-- Recipe items: raw materials in a recipe with quantities (PRD 5.5)
CREATE TABLE recipe_items (
    id              SERIAL PRIMARY KEY,
    recipe_id       INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id),
    quantity        NUMERIC(14,3) NOT NULL,   -- per standard batch_size
    unit            TEXT NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(recipe_id, raw_material_id)
);

CREATE INDEX idx_recipe_items_recipe ON recipe_items(recipe_id);
