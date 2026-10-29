-- 009_purchase_returns_payments.sql
-- Purchase returns (credit notes) and supplier payments/ledger (PRD 5.4).

CREATE TABLE purchase_returns (
    id              SERIAL PRIMARY KEY,
    return_number   TEXT NOT NULL UNIQUE,
    receipt_id      INTEGER NOT NULL REFERENCES purchase_receipts(id),
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    return_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    reason          TEXT,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_returns_supplier ON purchase_returns(supplier_id);

CREATE TABLE purchase_return_items (
    id              SERIAL PRIMARY KEY,
    return_id       INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    purchase_item_id INTEGER NOT NULL REFERENCES purchase_items(id),
    lot_id          INTEGER REFERENCES raw_material_lots(id),
    quantity        NUMERIC(14,3) NOT NULL,
    unit            TEXT NOT NULL,
    rate            NUMERIC(12,2) NOT NULL,
    line_amount     NUMERIC(14,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_return_items_return ON purchase_return_items(return_id);

-- Supplier payments and ledger (PRD 5.4)
CREATE TABLE supplier_payments (
    id              SERIAL PRIMARY KEY,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    payment_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount          NUMERIC(14,2) NOT NULL,
    payment_mode    TEXT NOT NULL CHECK (payment_mode IN ('cash','upi','card','bank_transfer','cheque','wallet')),
    reference_no    TEXT,
    notes           TEXT,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX idx_supplier_payments_date ON supplier_payments(payment_date);
