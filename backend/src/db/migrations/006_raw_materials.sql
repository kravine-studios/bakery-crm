-- 006_raw_materials.sql
-- Raw material master (PRD 5.4): name, unit, minimum stock, shelf life.

CREATE TABLE raw_materials (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    code            TEXT,                   -- short internal code
    description     TEXT,
    base_unit       TEXT NOT NULL,          -- primary unit (kg, litre, packet)
    min_stock_level  NUMERIC(14,3) NOT NULL DEFAULT 0,  -- low-stock alert threshold
    shelf_life_days  INTEGER,                -- perishable shelf life
    cost_method     TEXT NOT NULL DEFAULT 'avg' CHECK (cost_method IN ('avg','fifo')),  -- 5.4
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_raw_materials_name ON raw_materials(name);
CREATE INDEX idx_raw_materials_active ON raw_materials(is_active);

-- Unit conversions: litres->ml, kg->g, packets->kg (PRD 5.4)
CREATE TABLE unit_conversions (
    id              SERIAL PRIMARY KEY,
    raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    from_unit       TEXT NOT NULL,
    to_unit         TEXT NOT NULL,
    factor          NUMERIC(18,8) NOT NULL,  -- multiply qty in from_unit to get to_unit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(raw_material_id, from_unit, to_unit)
);

CREATE INDEX idx_unit_conv_material ON unit_conversions(raw_material_id);
