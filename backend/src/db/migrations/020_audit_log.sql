-- 020_audit_log.sql
-- Audit log: who did what when, with before/after values (PRD 5.14, NFR).

CREATE TABLE audit_log (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),  -- nullable for system events
    action          TEXT NOT NULL CHECK (action IN
                    ('create','update','delete','cancel','restore','login','logout')),
    entity          TEXT NOT NULL,                  -- 'product','bill','stock_adjustment','user', etc.
    entity_id       TEXT,                           -- accepts numeric or string IDs
    before          JSONB,                           -- state before change
    after           JSONB,                           -- state after change
    ip_address      TEXT,
    user_agent      TEXT,
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);
CREATE INDEX idx_audit_action ON audit_log(action);
