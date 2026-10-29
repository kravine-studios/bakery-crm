-- 017_orders.sql
-- Custom cakes and bulk orders (PRD 5.9).

CREATE TABLE orders (
    id              SERIAL PRIMARY KEY,
    order_number    TEXT NOT NULL UNIQUE,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    order_type      TEXT NOT NULL DEFAULT 'custom' CHECK (order_type IN ('custom','bulk','festival')),
    order_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivery_type   TEXT NOT NULL DEFAULT 'pickup' CHECK (delivery_type IN ('pickup','delivery')),
    pickup_date     DATE,
    pickup_time     TIME,
    delivery_date   DATE,
    delivery_address TEXT,
    delivery_charge  NUMERIC(14,2) NOT NULL DEFAULT 0,
    assigned_person  TEXT,                       -- delivery person (5.9)
    total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    advance_paid    NUMERIC(14,2) NOT NULL DEFAULT 0,
    balance_due     NUMERIC(14,2) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'booked'
                    CHECK (status IN ('booked','in_production','ready','delivered','cancelled')),
    customisation_notes TEXT,                    -- cake message, flavour, design ref (5.9)
    final_bill_id   INTEGER REFERENCES bills(id),  -- advance adjusted in final bill (5.9)
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_delivery ON orders(delivery_date);

CREATE TABLE order_items (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      INTEGER REFERENCES products(id),
    variant_id      INTEGER REFERENCES product_variants(id),
    item_name       TEXT NOT NULL,
    quantity        NUMERIC(14,3) NOT NULL,
    unit            TEXT NOT NULL,
    rate            NUMERIC(12,2) NOT NULL,
    amount          NUMERIC(14,2) NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
