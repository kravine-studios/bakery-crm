/**
 * Authentication service
 *
 * Exposes two login functions matching the two UI tabs:
 *   ownerLogin  — admin role only (Owner Login tab)
 *   staffLogin  — manager or cashier (Staff Login tab), role must match
 *
 * Security properties
 *   - Constant-time dummy hash comparison for unknown usernames (timing-safe)
 *   - Generic error messages — never reveal which field was wrong
 *   - Lockout: 5 failed attempts in 10 min → locked 15 min
 *   - Audit-logged: success, failure, lockout, logout
 *   - No password or hash in any return value or log
 *   - PIN login removed entirely
 */

import bcrypt     from 'bcryptjs';
import jwt        from 'jsonwebtoken';
import { query }  from '../../config/database';
import { env }    from '../../config/env';
import { Role }   from '../../types/enums';
import { ApiError }  from '../../middleware/errorHandler';
import { auditLog }  from '../../middleware/audit';
import { AuditAction } from '../../types/enums';
import type { Request } from 'express';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS   = 5;        // failures before lockout
const WINDOW_MINUTES = 10;       // window for counting failures
const LOCK_MINUTES   = 15;       // lockout duration

/**
 * A dummy bcrypt hash used when the username does not exist.
 * Ensures constant-time comparison so timing cannot reveal valid usernames.
 */
const DUMMY_HASH = '$2b$12$abcdefghijklmnopqrstuvuWDnq1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

// ─── Internal types ───────────────────────────────────────────────────────────

interface UserRow {
  id:              number;
  username:        string;
  password_hash:   string;
  role:            Role;
  display_name:    string;
  is_active:       boolean;
  failed_attempts: number;
  last_failed_at:  string | null;
  locked_until:    string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function issueTokens(user: Pick<UserRow, 'id' | 'username' | 'role' | 'display_name'>) {
  const payload = {
    sub:         user.id,
    username:    user.username,
    role:        user.role,
    displayName: user.display_name,
  };
  const accessToken  = jwt.sign(payload, env.jwt.secret,        { expiresIn: env.jwt.expiresIn });
  const refreshToken = jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiresIn });
  return { accessToken, refreshToken };
}

function publicUser(user: Pick<UserRow, 'id' | 'username' | 'role' | 'display_name'>) {
  return { id: user.id, username: user.username, role: user.role, displayName: user.display_name };
}

/** Record a failed attempt; apply lockout if threshold reached. */
async function recordFailure(userId: number) {
  // Increment counter (reset if last failure was outside the window)
  await query(
    `UPDATE users
     SET failed_attempts = CASE
           WHEN last_failed_at > NOW() - $1::interval THEN failed_attempts + 1
           ELSE 1
         END,
         last_failed_at = NOW(),
         locked_until = CASE
           WHEN (CASE
                   WHEN last_failed_at > NOW() - $1::interval THEN failed_attempts + 1
                   ELSE 1
                 END) >= $2
           THEN NOW() + $3::interval
           ELSE locked_until
         END
     WHERE id = $4`,
    [
      `${WINDOW_MINUTES} minutes`,
      MAX_ATTEMPTS,
      `${LOCK_MINUTES} minutes`,
      userId,
    ]
  );
}

/** Clear failure counter on successful login. */
async function clearFailures(userId: number, tab: 'owner' | 'staff') {
  await query(
    `UPDATE users
     SET failed_attempts = 0,
         last_failed_at  = NULL,
         locked_until    = NULL,
         last_login_at   = NOW(),
         last_login_tab  = $1
     WHERE id = $2`,
    [tab, userId]
  );
}

// ─── Generic auth core (shared by both tabs) ─────────────────────────────────

async function doLogin(params: {
  username:     string;
  password:     string;
  allowedRoles: Role[];
  tab:          'owner' | 'staff';
  req:          Request;
}) {
  const { username, password, allowedRoles, tab, req } = params;

  // Fetch user — case-insensitive username lookup
  const result = await query<UserRow>(
    `SELECT id, username, password_hash, role, display_name, is_active,
            failed_attempts, last_failed_at, locked_until
     FROM users
     WHERE LOWER(username) = LOWER($1)`,
    [username]
  );

  const user     = result.rows[0] ?? null;
  const hashToCheck = user ? user.password_hash : DUMMY_HASH;

  // Always run bcrypt compare even for unknown users (timing-safe)
  const passwordMatches = await bcrypt.compare(password, hashToCheck);

  // ── Account not found or role not allowed for this tab ────────
  if (!user || !allowedRoles.includes(user.role)) {
    await auditLog({
      userId:   user?.id ?? 0,
      action:   AuditAction.Login,
      entity:   'auth',
      entityId: user?.id ?? 0,
      after:    { tab, success: false, reason: 'unknown_username_or_wrong_tab' },
      req,
    });
    // Deliberate generic message
    throw new ApiError(401, 'Invalid username, role or password');
  }

  // ── Locked ───────────────────────────────────────────────────
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remainMs   = new Date(user.locked_until).getTime() - Date.now();
    const remainMins = Math.ceil(remainMs / 60_000);
    await auditLog({
      userId: user.id, action: AuditAction.Login, entity: 'auth', entityId: user.id,
      after:  { tab, success: false, reason: 'locked', locked_until: user.locked_until },
      req,
    });
    throw new ApiError(
      429,
      `Too many attempts. Try again in ${remainMins} minute${remainMins !== 1 ? 's' : ''}.`
    );
  }

  // ── Inactive ──────────────────────────────────────────────────
  if (!user.is_active) {
    await auditLog({
      userId: user.id, action: AuditAction.Login, entity: 'auth', entityId: user.id,
      after:  { tab, success: false, reason: 'inactive' },
      req,
    });
    throw new ApiError(401, 'Invalid username, role or password');
  }

  // ── Wrong password ────────────────────────────────────────────
  if (!passwordMatches) {
    await recordFailure(user.id);

    // Re-fetch to check if this failure just triggered a lockout
    const updated = await query<{ locked_until: string | null; failed_attempts: number }>(
      `SELECT locked_until, failed_attempts FROM users WHERE id = $1`,
      [user.id]
    );
    const nowLocked = updated.rows[0]?.locked_until
      ? new Date(updated.rows[0].locked_until) > new Date()
      : false;

    await auditLog({
      userId: user.id, action: AuditAction.Login, entity: 'auth', entityId: user.id,
      after:  { tab, success: false, reason: 'wrong_password', locked: nowLocked },
      req,
    });

    if (nowLocked) {
      throw new ApiError(
        429,
        `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`
      );
    }

    throw new ApiError(401, 'Invalid username, role or password');
  }

  // ── Success ───────────────────────────────────────────────────
  await clearFailures(user.id, tab);

  const { accessToken, refreshToken } = issueTokens(user);

  await auditLog({
    userId: user.id, action: AuditAction.Login, entity: 'auth', entityId: user.id,
    after:  { tab, success: true },
    req,
  });

  return { accessToken, refreshToken, user: publicUser(user) };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Owner Login tab — ADMIN role only.
 */
export async function ownerLogin(username: string, password: string, req: Request) {
  return doLogin({ username, password, allowedRoles: [Role.Admin], tab: 'owner', req });
}

/**
 * Staff Login tab — MANAGER or CASHIER only.
 * Additionally validates that the given `expectedRole` matches the account role
 * (server enforces it, client selection is untrusted).
 */
export async function staffLogin(
  username:     string,
  password:     string,
  expectedRole: Role,
  req:          Request
) {
  // Only manager/cashier allowed on staff tab
  if (expectedRole === Role.Admin) {
    throw new ApiError(401, 'Invalid username, role or password');
  }

  const result = await doLogin({
    username,
    password,
    allowedRoles: [Role.Manager, Role.Cashier],
    tab: 'staff',
    req,
  });

  // The server must confirm that the role the client selected matches the actual account role.
  // If they differ, the login is rejected — the client tab choice is never trusted.
  if (result.user.role !== expectedRole) {
    await auditLog({
      userId: result.user.id, action: AuditAction.Login, entity: 'auth', entityId: result.user.id,
      after:  { tab: 'staff', success: false, reason: 'role_mismatch' },
      req,
    });
    throw new ApiError(401, 'Invalid username, role or password');
  }

  return result;
}

/**
 * Refresh access token using a valid refresh token.
 */
export function refreshAccessToken(token: string) {
  try {
    const decoded = jwt.verify(token, env.jwt.refreshSecret) as unknown as {
      sub: number; username: string; role: Role; displayName: string;
    };
    const payload = { sub: decoded.sub, username: decoded.username, role: decoded.role, displayName: decoded.displayName };
    const accessToken = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
    return { accessToken, user: payload };
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
}

/**
 * Logout — audit log entry only. Token invalidation is handled
 * client-side (remove from localStorage). Add a token denylist later if needed.
 */
export async function logout(userId: number, req: Request) {
  await auditLog({
    userId, action: AuditAction.Logout, entity: 'auth', entityId: userId, req,
  });
}

/**
 * Admin-only: unlock a user account (clear lockout).
 */
export async function unlockUser(targetId: number, adminId: number, req: Request) {
  await query(
    `UPDATE users SET locked_until = NULL, failed_attempts = 0 WHERE id = $1`,
    [targetId]
  );
  await auditLog({
    userId: adminId, action: AuditAction.Update, entity: 'user', entityId: targetId,
    after:  { locked_until: null, failed_attempts: 0 },
    req, reason: 'Admin unlocked account',
  });
}
