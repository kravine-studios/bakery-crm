-- 016_returns_credit_notes.sql
-- Returns, exchanges, credit notes (PRD 5.7).
-- Also adds FK from loyalty_transactions.bill_id → bills (deferred from 014).

-- Add FK now that bills table exists
ALTER TABLE loyalty_transactions
    ADD CONSTRAINT fk_loyalty_bill FOREIGN KEY (bill_id) REFERENCES bills(id);

ALTER TABLE customer_feedback
    ADD CONSTRAINT fk_feedback_bill FOREIGN KEY (bill_id) REFERENCES bills(id);

-- Credit notes for returns (PRD 5.7)
CREATE TABLE credit_notes (
    id              SERIAL PRIMARY KEY,
    credit_note_number TEXT NOT NULL UNIQUE,
    original_bill_id INTEGER NOT NULL REFERENCES bills(id),
    return_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,  -- amount credited/returned
    reason          TEXT,
    processed_by    INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_notes_bill ON credit_notes(original_bill_id);

-- Return line items: which bill items are being returned (PRD 5.7)
CREATE TABLE return_items (
    id              SERIAL PRIMARY KEY,
    credit_note_id  INTEGER NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
    bill_item_id    INTEGER NOT NULL REFERENCES bill_items(id),
    product_id      INTEGER NOT NULL REFERENCES products(id),
    batch_id        INTEGER REFERENCES production_batches(id),
    quantity        NUMERIC(14,3) NOT NULL,
    unit            TEXT NOT NULL,
    rate            NUMERIC(12,2) NOT NULL,
    amount          NUMERIC(14,2) NOT NULL,
    gst_reversed    NUMERIC(14,2) NOT NULL DEFAULT 0,
    to_wastage      BOOLEAN NOT NULL DEFAULT FALSE,  -- food items go to wastage (5.7)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_return_items_cn ON return_items(credit_note_id);
