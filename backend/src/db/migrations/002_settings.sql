-- 002_settings.sql
-- Single-row shop settings table (PRD 5.14).
-- Constrained to one row so it acts as a global config singleton.

CREATE TABLE settings (
    id              SERIAL PRIMARY KEY CHECK (id = 1),  -- singleton
    shop_name       TEXT NOT NULL DEFAULT 'My Bakery',
    logo_url        TEXT,
    address         TEXT,
    phone           TEXT,
    email           TEXT,
    gstin           TEXT,
    fssai_number    TEXT,
    invoice_prefix  TEXT NOT NULL DEFAULT 'INV',
    invoice_footer  TEXT NOT NULL DEFAULT 'Thank you! Visit again.',
    tax_inclusive   BOOLEAN NOT NULL DEFAULT FALSE,  -- GST-inclusive vs exclusive (Open Q 11)
    currency        TEXT NOT NULL DEFAULT 'INR',
    receipt_paper   TEXT NOT NULL DEFAULT '80mm' CHECK (receipt_paper IN ('58mm','80mm','A4')),
    stock_block_zero BOOLEAN NOT NULL DEFAULT FALSE,  -- block billing at zero stock (5.7)
    loyalty_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    loyalty_points_per_rupee NUMERIC(10,4) DEFAULT 0,
    loyalty_min_redeem INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by      INTEGER REFERENCES users(id)
);
