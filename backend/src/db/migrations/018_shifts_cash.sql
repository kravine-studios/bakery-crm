-- 018_shifts_cash.sql
-- Shifts and cash management (PRD 5.10).
-- Each cashier login tied to a shift; cash reconciliation at close.

CREATE TABLE shifts (
    id              SERIAL PRIMARY KEY,
    cashier_id      INTEGER NOT NULL REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    opening_float   NUMERIC(14,2) NOT NULL DEFAULT 0,  -- opening cash float
    expected_cash   NUMERIC(14,2) DEFAULT 0,           -- system-calculated from bills
    counted_cash    NUMERIC(14,2),                      -- physical count at close
    shortage        NUMERIC(14,2) DEFAULT 0,            -- counted - expected (negative = shortage)
    notes           TEXT,
    closed_by       INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shifts_cashier ON shifts(cashier_id);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_opened ON shifts(opened_at);

-- Cash in / cash out entries (petty cash, supplier cash payments) — PRD 5.10
CREATE TABLE cash_entries (
    id              SERIAL PRIMARY KEY,
    shift_id        INTEGER NOT NULL REFERENCES shifts(id),
    entry_type      TEXT NOT NULL CHECK (entry_type IN ('cash_in','cash_out')),
    amount          NUMERIC(14,2) NOT NULL,
    reason          TEXT,
    reference_type  TEXT,                       -- 'petty','supplier_payment','expense'
    reference_id    INTEGER,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_entries_shift ON cash_entries(shift_id);
CREATE INDEX idx_cash_entries_type ON cash_entries(entry_type);
