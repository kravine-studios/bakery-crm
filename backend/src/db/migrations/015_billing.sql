-- 015_billing.sql
-- Bills (invoices), bill items, payments (PRD 5.7).
-- Sequential gap-free invoice numbers per financial year (5.7).
-- Bills are never edited after creation — corrections via reversing entries (PRD 7).

-- Invoice number sequence per financial year
CREATE TABLE invoice_sequences (
    id              SERIAL PRIMARY KEY,
    fin_year        TEXT NOT NULL,             -- e.g. "FY2026" (Apr 2025-Mar 2026)
    last_number     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(fin_year)
);

CREATE TABLE bills (
    id              SERIAL PRIMARY KEY,
    invoice_number  TEXT NOT NULL UNIQUE,     -- e.g. "INV-FY2026-00001"
    fin_year        TEXT NOT NULL,             -- which FY sequence was used
    bill_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','held','paid','cancelled','returned')),
    customer_id     INTEGER REFERENCES customers(id),
    customer_name   TEXT,
    customer_phone  TEXT,
    cashier_id      INTEGER NOT NULL REFERENCES users(id),
    shift_id        INTEGER,                   -- shift reference (5.10)
    subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,  -- sum of line taxable values
    total_discount  NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_cgst      NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_sgst      NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_igst      NUMERIC(14,2) NOT NULL DEFAULT 0,
    round_off       NUMERIC(14,2) NOT NULL DEFAULT 0,
    grand_total     NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount_in_words TEXT,
    notes           TEXT,
    held_at          TIMESTAMPTZ,               -- when bill was held/resumed (5.7)
    print_count     INTEGER NOT NULL DEFAULT 0,  -- reprint tracking (duplicate mark)
    cancel_reason   TEXT,
    cancelled_by    INTEGER REFERENCES users(id),
    cancelled_at    TIMESTAMPTZ,
    cancel_approved_by INTEGER REFERENCES users(id),  -- manager approval (5.7)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bills_invoice ON bills(invoice_number);
CREATE INDEX idx_bills_date ON bills(bill_date);
CREATE INDEX idx_bills_customer ON bills(customer_id);
CREATE INDEX idx_bills_cashier ON bills(cashier_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_shift ON bills(shift_id);

-- Bill line items (PRD 5.7)
CREATE TABLE bill_items (
    id              SERIAL PRIMARY KEY,
    bill_id         INTEGER NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
    product_id      INTEGER REFERENCES products(id),
    variant_id      INTEGER REFERENCES product_variants(id),
    combo_id        INTEGER REFERENCES combos(id),
    batch_id        INTEGER REFERENCES production_batches(id),  -- which batch was sold (FEFO)
    item_name       TEXT NOT NULL,             -- snapshot at sale time
    hsn_code        TEXT,
    quantity        NUMERIC(14,3) NOT NULL,
    unit            TEXT NOT NULL,
    rate            NUMERIC(12,2) NOT NULL,    -- rate per unit
    base_amount     NUMERIC(14,2) NOT NULL,    -- qty * rate
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    taxable_value   NUMERIC(14,2) NOT NULL,    -- after discount
    gst_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
    cgst_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
    sgst_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
    igst_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(14,2) NOT NULL,    -- taxable + gst
    line_cost       NUMERIC(14,2) NOT NULL DEFAULT 0,  -- COGS for profit calc
    notes           TEXT,
    is_returned     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX idx_bill_items_product ON bill_items(product_id);
CREATE INDEX idx_bill_items_batch ON bill_items(batch_id);

-- Payments: cash, UPI, card, wallet, credit; split payment (PRD 5.7)
CREATE TABLE payments (
    id              SERIAL PRIMARY KEY,
    bill_id         INTEGER NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
    payment_mode    TEXT NOT NULL CHECK (payment_mode IN ('cash','upi','card','wallet','credit')),
    amount          NUMERIC(14,2) NOT NULL,
    reference_no    TEXT,                      -- UPI ref, card last4, etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_bill ON payments(bill_id);
CREATE INDEX idx_payments_mode ON payments(payment_mode);
