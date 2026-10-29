import bcrypt from 'bcryptjs';
import { query } from '../../config/database';
import { env } from '../../config/env';
import { Role } from '../../types/enums';
import { ApiError } from '../../middleware/errorHandler';
import { auditLog } from '../../middleware/audit';
import { AuditAction } from '../../types/enums';
import type { Request } from 'express';

interface UserRow {
  id: number;
  username: string;
  role: Role;
  display_name: string;
  is_active: boolean;
  discount_limit: string;
  created_at: string;
  deactivated_at: string | null;
}

export async function listUsers(includeInactive = false) {
  const sql = includeInactive
    ? `SELECT id, username, role, display_name, is_active, discount_limit::text,
              created_at, deactivated_at
       FROM users ORDER BY id ASC`
    : `SELECT id, username, role, display_name, is_active, discount_limit::text,
              created_at
       FROM users WHERE is_active = TRUE ORDER BY id ASC`;
  const result = await query<UserRow>(sql);
  return result.rows.map((r) => ({
    ...r,
    discountLimit: parseFloat(r.discount_limit),
  }));
}

export async function getUserById(id: number) {
  const result = await query<UserRow>(
    `SELECT id, username, role, display_name, is_active, discount_limit::text,
            created_at, deactivated_at
     FROM users WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) throw new ApiError(404, 'User not found');
  return { ...result.rows[0], discountLimit: parseFloat(result.rows[0].discount_limit) };
}

interface CreateUserParams {
  username: string;
  password: string;
  role: Role;
  displayName: string;
  pin?: string;
  discountLimit?: number;
  createdBy: number;
  req: Request;
}

export async function createUser(params: CreateUserParams) {
  const {
    username, password, role, displayName, pin, discountLimit = 0, createdBy, req,
  } = params;

  // A manager can only create cashiers (PRD 3)
  const creator = await getUserById(createdBy);
  if (creator.role === Role.Manager && role !== Role.Cashier) {
    throw new ApiError(403, 'Managers can only create cashier accounts');
  }
  if (role === Role.Admin && creator.role !== Role.Admin) {
    throw new ApiError(403, 'Only admins can create admin accounts');
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const pinHash = pin ? await bcrypt.hash(pin, env.bcryptRounds) : null;

  const result = await query<{ id: number }>(
    `INSERT INTO users (username, password_hash, role, display_name, pin_hash, discount_limit,
                        is_active, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, NOW())
     RETURNING id`,
    [username, passwordHash, role, displayName, pinHash, discountLimit, createdBy]
  );

  const newId = result.rows[0].id;
  await auditLog({
    userId: createdBy,
    action: AuditAction.Create,
    entity: 'user',
    entityId: newId,
    after: { username, role, displayName, discountLimit },
    req,
  });

  return { id: newId, username, role, displayName };
}

interface UpdateUserParams {
  id: number;
  displayName?: string;
  pin?: string;
  discountLimit?: number;
  role?: Role;
  updatedBy: number;
  req: Request;
}

export async function updateUser(params: UpdateUserParams) {
  const { id, displayName, pin, discountLimit, role, updatedBy, req } = params;
  const existing = await getUserById(id);
  const before = { ...existing };

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (displayName !== undefined) {
    updates.push(`display_name = $${paramIdx++}`);
    values.push(displayName);
  }
  if (pin !== undefined) {
    updates.push(`pin_hash = $${paramIdx++}`);
    values.push(await bcrypt.hash(pin, env.bcryptRounds));
  }
  if (discountLimit !== undefined) {
    updates.push(`discount_limit = $${paramIdx++}`);
    values.push(discountLimit);
  }
  if (role !== undefined) {
    // Only admin can change roles
    const updater = await getUserById(updatedBy);
    if (updater.role !== Role.Admin) {
      throw new ApiError(403, 'Only admins can change user roles');
    }
    updates.push(`role = $${paramIdx++}`);
    values.push(role);
  }

  if (updates.length === 0) return existing;

  values.push(id);
  await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
    values
  );

  const after = await getUserById(id);
  await auditLog({
    userId: updatedBy,
    action: AuditAction.Update,
    entity: 'user',
    entityId: id,
    before,
    after,
    req,
  });

  return after;
}

export async function resetPassword(id: number, newPassword: string, resetBy: number, req: Request) {
  // Managers can only reset cashier passwords (PRD 5.1)
  const target = await getUserById(id);
  const resetter = await getUserById(resetBy);

  if (resetter.role === Role.Manager && target.role !== Role.Cashier) {
    throw new ApiError(403, 'Managers can only reset cashier passwords');
  }

  const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);

  await auditLog({
    userId: resetBy,
    action: AuditAction.Update,
    entity: 'user',
    entityId: id,
    before: { password: '***' },
    after: { password: '***' },
    req,
    reason: 'Password reset',
  });
}

export async function deactivateUser(id: number, reason: string, deactivatedBy: number, req: Request) {
  const target = await getUserById(id);
  const deactivator = await getUserById(deactivatedBy);

  if (deactivator.role === Role.Manager && target.role !== Role.Cashier) {
    throw new ApiError(403, 'Managers can only deactivate cashiers');
  }
  if (id === deactivatedBy) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  await query(
    `UPDATE users SET is_active = FALSE, deactivated_at = NOW(), deactivated_by = $1,
                     deactivate_reason = $2 WHERE id = $3`,
    [deactivatedBy, reason, id]
  );

  await auditLog({
    userId: deactivatedBy,
    action: AuditAction.Update,
    entity: 'user',
    entityId: id,
    before: { is_active: true },
    after: { is_active: false, reason },
    req,
    reason: 'Account deactivated',
  });
}
