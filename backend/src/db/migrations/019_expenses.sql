-- 019_expenses.sql
-- Expenses by category (PRD 5.11): used together with COGS for profit calc.

CREATE TABLE expenses (
    id              SERIAL PRIMARY KEY,
    expense_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category        TEXT NOT NULL CHECK (category IN
                    ('electricity','rent','salaries','gas','packaging','transport','repairs','others')),
    amount          NUMERIC(14,2) NOT NULL,
    payment_mode    TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash','upi','card','bank_transfer','cheque','wallet')),
    reference_no    TEXT,
    description     TEXT,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
