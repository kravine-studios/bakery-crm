-- 025_auth_lockout.sql
-- Adds login-lockout tracking and last_login to users.
-- Lockout: after 5 failed attempts within 10 min, locked for 15 min.
-- Admin can manually unlock (locked_until = NULL).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_attempts   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_tab    TEXT; -- 'owner' | 'staff'

COMMENT ON COLUMN users.failed_attempts IS 'Consecutive failed login attempts (resets on success)';
COMMENT ON COLUMN users.locked_until IS 'NULL = not locked. Set to future time to lock the account.';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of most recent successful login';
COMMENT ON COLUMN users.last_login_tab IS 'Which login tab was used: owner or staff';

CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;
