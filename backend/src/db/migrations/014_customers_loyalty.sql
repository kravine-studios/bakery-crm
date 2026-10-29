-- 014_customers_loyalty.sql
-- Customer management and loyalty (PRD 5.8).

CREATE TABLE customers (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    phone           TEXT NOT NULL,            -- primary key for lookup at billing
    email           TEXT,
    birthday        DATE,
    anniversary     DATE,
    address         TEXT,
    notes           TEXT,
    is_credit_customer BOOLEAN NOT NULL DEFAULT FALSE,  -- B2B/institution/caterer (5.8)
    credit_limit    NUMERIC(14,2) NOT NULL DEFAULT 0,
    credit_balance  NUMERIC(14,2) NOT NULL DEFAULT 0,   -- outstanding
    loyalty_points  INTEGER NOT NULL DEFAULT 0,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(phone)
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_credit ON customers(is_credit_customer);

-- Loyalty transactions: earn and redeem (PRD 5.8)
CREATE TABLE loyalty_transactions (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('earn','redeem','adjust')),
    points          INTEGER NOT NULL,           -- positive earn, negative redeem
    bill_id         INTEGER,                    -- bill that earned/redeemed (FK added in 015)
    balance_after   INTEGER NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loyalty_customer ON loyalty_transactions(customer_id);
CREATE INDEX idx_loyalty_bill ON loyalty_transactions(bill_id);

-- Customer feedback capture (PRD 5.8)
CREATE TABLE customer_feedback (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER REFERENCES customers(id),
    bill_id         INTEGER,
    rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
    comments        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_customer ON customer_feedback(customer_id);
