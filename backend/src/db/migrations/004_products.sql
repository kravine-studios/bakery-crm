-- 004_products.sql
-- Products, variants, price history (PRD 5.2).
-- Two kinds: produced items (linked to a recipe) and traded items (bought and resold).

CREATE TABLE products (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    category_id     INTEGER NOT NULL REFERENCES categories(id),
    product_type    TEXT NOT NULL CHECK (product_type IN ('produced', 'traded')),
    sku             TEXT UNIQUE,                 -- SKU or barcode
    hsn_code        TEXT,
    gst_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
    selling_unit    TEXT NOT NULL CHECK (selling_unit IN ('piece','kg','gram','box','dozen','litre','ml','packet')),
    mrp             NUMERIC(12,2),               -- max retail price
    selling_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
    cost_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_weighed       BOOLEAN NOT NULL DEFAULT FALSE,  -- sold by weight (5.2)
    food_type       TEXT NOT NULL DEFAULT 'veg' CHECK (food_type IN ('veg','non_veg','egg')),
    allergens       TEXT[],                          -- allergen tags (5.2)
    shelf_life_days INTEGER,                          -- for expiry calc (5.5)
    image_url       TEXT,
    description     TEXT,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      INTEGER REFERENCES users(id)
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_active ON products(is_active);

-- Variants: size/weight options (250g, 500g, 1kg box; 0.5kg, 1kg cake) — PRD 5.2
CREATE TABLE product_variants (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,          -- e.g. "500 g box"
    unit            TEXT NOT NULL,           -- unit for this variant
    weight_value    NUMERIC(12,3),          -- numeric weight if applicable
    selling_price   NUMERIC(12,2) NOT NULL,
    cost_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
    mrp             NUMERIC(12,2),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, name)
);

CREATE INDEX idx_variants_product ON product_variants(product_id);

-- Price history: every price change recorded with who changed it (PRD 5.2)
CREATE TABLE price_history (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    variant_id      INTEGER REFERENCES product_variants(id),
    old_price       NUMERIC(12,2),
    new_price       NUMERIC(12,2) NOT NULL,
    field           TEXT NOT NULL DEFAULT 'selling_price',  -- selling_price or cost_price
    changed_by      INTEGER NOT NULL REFERENCES users(id),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason          TEXT
);

CREATE INDEX idx_price_history_product ON price_history(product_id, changed_at DESC);
