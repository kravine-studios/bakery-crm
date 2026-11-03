/**
 * User management service.
 *
 * Security properties:
 *   - Password hashes are NEVER returned to callers.
 *   - The "fingerprint" (first 8 hex chars of SHA-256 of the stored hash) is
 *     returned only to admin sessions.
 *   - Admin cannot demote/deactivate their own account.
 *   - "Admin" role cannot be assigned to new users.
 *   - Passwords are validated against the policy before hashing.
 */

import crypto  from 'crypto';
import bcrypt  from 'bcryptjs';
import { query }     from '../../config/database';
import { env }       from '../../config/env';
import { Role }      from '../../types/enums';
import { ApiError }  from '../../middleware/errorHandler';
import { auditLog }  from '../../middleware/audit';
import { AuditAction } from '../../types/enums';
import { checkPassword, generateStrongPassword } from '../../utils/passwordPolicy';
import type { Request } from 'express';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id:               number;
  username:         string;
  role:             Role;
  display_name:     string;
  is_active:        boolean;
  discount_limit:   string;
  created_at:       string;
  deactivated_at:   string | null;
  locked_until:     string | null;
  failed_attempts:  number;
  last_login_at:    string | null;
  last_login_tab:   string | null;
  password_hash?:   string;   // only fetched internally
}

/** Safe projection — strip password_hash, add fingerprint for admin */
function safeUser(r: UserRow, requestingRole: Role) {
  const base = {
    id:            r.id,
    username:      r.username,
    role:          r.role,
    displayName:   r.display_name,
    isActive:      r.is_active,
    discountLimit: parseFloat(r.discount_limit),
    createdAt:     r.created_at,
    deactivatedAt: r.deactivated_at,
    lastLoginAt:   r.last_login_at,
    lastLoginTab:  r.last_login_tab,
    isLocked:      !!r.locked_until && new Date(r.locked_until) > new Date(),
    lockedUntil:   r.locked_until,
  };

  // Fingerprint: first 8 hex chars of SHA-256(stored_hash) — admin only
  if (requestingRole === Role.Admin && r.password_hash) {
    const fingerprint = crypto
      .createHash('sha256')
      .update(r.password_hash)
      .digest('hex')
      .slice(0, 8);
    return { ...base, passwordFingerprint: fingerprint };
  }

  return base;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listUsers(includeInactive: boolean, requestingRole: Role) {
  const sql = `
    SELECT id, username, role, display_name, is_active,
           discount_limit::text, created_at, deactivated_at,
           locked_until, failed_attempts, last_login_at, last_login_tab
           ${requestingRole === Role.Admin ? ', password_hash' : ''}
    FROM users
    ${includeInactive ? '' : 'WHERE is_active = TRUE'}
    ORDER BY id ASC
  `;
  const result = await query<UserRow>(sql);
  return result.rows.map((r) => safeUser(r, requestingRole));
}

// ─── Get by ID ────────────────────────────────────────────────────────────────

export async function getUserById(id: number, requestingRole: Role = Role.Cashier) {
  const result = await query<UserRow>(
    `SELECT id, username, role, display_name, is_active,
            discount_limit::text, created_at, deactivated_at,
            locked_until, failed_attempts, last_login_at, last_login_tab
            ${requestingRole === Role.Admin ? ', password_hash' : ''}
     FROM users WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) throw new ApiError(404, 'User not found');
  return safeUser(result.rows[0], requestingRole);
}

/** Internal — fetches password_hash for auth use only. Never expose this to callers. */
export async function getUserByIdInternal(id: number) {
  const result = await query<UserRow>(
    `SELECT id, username, password_hash, role, display_name, is_active,
            discount_limit::text, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) throw new ApiError(404, 'User not found');
  return result.rows[0];
}

// ─── Create ───────────────────────────────────────────────────────────────────

interface CreateUserParams {
  username:      string;
  password:      string;
  role:          Role;
  displayName:   string;
  discountLimit?: number;
  createdBy:     number;
  req:           Request;
}

export async function createUser(params: CreateUserParams) {
  const { username, password, role, displayName, discountLimit = 0, createdBy, req } = params;

  // Admin role cannot be created via API (only via seed)
  if (role === Role.Admin) {
    throw new ApiError(403, 'Admin accounts cannot be created via this endpoint');
  }

  // Password policy check
  const policy = checkPassword(password);
  if (!policy.ok) {
    throw new ApiError(422, policy.errors.join(' '));
  }

  // Case-insensitive uniqueness
  const existing = await query(
    `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
    [username]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    throw new ApiError(409, `Username "${username}" is already taken`);
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);

  const result = await query<{ id: number }>(
    `INSERT INTO users
       (username, password_hash, role, display_name, discount_limit, is_active, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6, NOW(), NOW())
     RETURNING id`,
    [username.toLowerCase(), passwordHash, role, displayName, discountLimit, createdBy]
  );

  const newId = result.rows[0].id;
  await auditLog({
    userId: createdBy,
    action: AuditAction.Create,
    entity: 'user',
    entityId: newId,
    after:  { username, role, displayName, discountLimit },
    req,
  });

  return getUserById(newId, Role.Admin);
}

// ─── Update ───────────────────────────────────────────────────────────────────

interface UpdateUserParams {
  id:             number;
  displayName?:   string;
  discountLimit?: number;
  isActive?:      boolean;
  updatedBy:      number;
  req:            Request;
}

export async function updateUser(params: UpdateUserParams) {
  const { id, displayName, discountLimit, isActive, updatedBy, req } = params;

  const existing = await getUserByIdInternal(id);
  const before   = { displayName: existing.display_name, discountLimit: parseFloat(existing.discount_limit ?? '0'), isActive: existing.is_active };

  // Admin cannot deactivate themselves
  if (id === updatedBy && isActive === false) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (displayName   !== undefined) { updates.push(`display_name   = $${idx++}`); values.push(displayName); }
  if (discountLimit !== undefined) { updates.push(`discount_limit = $${idx++}`); values.push(discountLimit); }
  if (isActive      !== undefined) { updates.push(`is_active      = $${idx++}`); values.push(isActive); }
  if (updates.length === 0) return getUserById(id, Role.Admin);

  updates.push(`updated_at = NOW()`);
  values.push(id);
  await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);

  const after = await getUserById(id, Role.Admin);
  await auditLog({
    userId: updatedBy, action: AuditAction.Update, entity: 'user', entityId: id,
    before, after, req,
  });
  return after;
}

// ─── Reset password ───────────────────────────────────────────────────────────

export async function resetPassword(
  id:        number,
  newPassword: string | null, // null → generate
  resetBy:   number,
  req:       Request
): Promise<{ generatedPassword?: string }> {
  const generated = newPassword === null;
  const plaintext = generated ? generateStrongPassword() : newPassword!;

  const policy = checkPassword(plaintext);
  if (!policy.ok) {
    throw new ApiError(422, policy.errors.join(' '));
  }

  const passwordHash = await bcrypt.hash(plaintext, env.bcryptRounds);
  await query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [passwordHash, id]
  );

  await auditLog({
    userId: resetBy, action: AuditAction.Update, entity: 'user', entityId: id,
    before: { password: '***' }, after: { password: '***' },
    req, reason: 'Password reset by admin',
  });

  // Return the generated password to show ONCE in the UI (if generated)
  return generated ? { generatedPassword: plaintext } : {};
}

// ─── Deactivate / Activate ────────────────────────────────────────────────────

export async function deactivateUser(id: number, reason: string, deactivatedBy: number, req: Request) {
  if (id === deactivatedBy) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  const target = await getUserByIdInternal(id);
  if (target.role === Role.Admin) {
    throw new ApiError(403, 'The admin account cannot be deactivated');
  }

  await query(
    `UPDATE users SET is_active = FALSE, deactivated_at = NOW(),
                      deactivated_by = $1, deactivate_reason = $2, updated_at = NOW()
     WHERE id = $3`,
    [deactivatedBy, reason, id]
  );

  await auditLog({
    userId: deactivatedBy, action: AuditAction.Update, entity: 'user', entityId: id,
    before: { is_active: true }, after: { is_active: false, reason }, req, reason: 'Account deactivated',
  });
}

export async function activateUser(id: number, activatedBy: number, req: Request) {
  await query(
    `UPDATE users SET is_active = TRUE, deactivated_at = NULL,
                      deactivated_by = NULL, deactivate_reason = NULL, updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
  await auditLog({
    userId: activatedBy, action: AuditAction.Update, entity: 'user', entityId: id,
    before: { is_active: false }, after: { is_active: true }, req, reason: 'Account reactivated',
  });
}

// ─── Unlock ───────────────────────────────────────────────────────────────────

export async function unlockUser(id: number, unlockedBy: number, req: Request) {
  await query(
    `UPDATE users SET locked_until = NULL, failed_attempts = 0, updated_at = NOW() WHERE id = $1`,
    [id]
  );
  await auditLog({
    userId: unlockedBy, action: AuditAction.Update, entity: 'user', entityId: id,
    after: { locked_until: null }, req, reason: 'Admin unlocked account',
  });
}
