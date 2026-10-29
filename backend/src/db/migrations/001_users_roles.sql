-- 001_users_roles.sql
-- Users table: stores all system users (admin, manager, cashier).
-- Users are deactivated, never hard-deleted (PRD rule 3), so old bills
-- keep their history via foreign keys.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
    display_name    TEXT NOT NULL,
    pin_hash        TEXT,          -- optional PIN for quick cashier login (5.1)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    discount_limit  NUMERIC(10,2) DEFAULT 0,  -- per-role discount cap (PRD 3)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      INTEGER REFERENCES users(id),
    deactivated_at  TIMESTAMPTZ,
    deactivated_by  INTEGER REFERENCES users(id),
    deactivate_reason TEXT
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
