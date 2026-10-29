import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
  password_hash: string;
  role: Role;
  display_name: string;
  is_active: boolean;
  pin_hash: string | null;
}

export async function login(username: string, password: string, req: Request) {
  const result = await query<UserRow>(
    `SELECT id, username, password_hash, role, display_name, is_active, pin_hash
     FROM users WHERE username = $1`,
    [username]
  );

  if (result.rowCount === 0) {
    throw new ApiError(401, 'Invalid username or password');
  }

  const user = result.rows[0];
  if (!user.is_active) {
    throw new ApiError(403, 'Your account has been deactivated. Contact the manager.');
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new ApiError(401, 'Invalid username or password');
  }

  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name,
  };

  const accessToken = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  const refreshToken = jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });

  await auditLog({
    userId: user.id,
    action: AuditAction.Login,
    entity: 'user',
    entityId: user.id,
    req,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name,
    },
  };
}

/**
 * PIN-based quick login for cashiers at a shared counter (PRD 5.1).
 * PIN is separate from password for speed at the counter.
 */
export async function pinLogin(pin: string, req: Request) {
  const result = await query<UserRow>(
    `SELECT id, username, password_hash, role, display_name, is_active, pin_hash
     FROM users WHERE pin_hash IS NOT NULL AND is_active = TRUE`
  );

  // Check PIN against all active cashiers with a pin set
  for (const user of result.rows) {
    if (user.pin_hash && (await bcrypt.compare(pin, user.pin_hash))) {
      const payload = {
        sub: user.id,
        username: user.username,
        role: user.role,
        displayName: user.display_name,
      };

      const accessToken = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
      const refreshToken = jwt.sign(payload, env.jwt.refreshSecret, {
        expiresIn: env.jwt.refreshExpiresIn,
      });

      await auditLog({
        userId: user.id,
        action: AuditAction.Login,
        entity: 'user',
        entityId: user.id,
        req,
        reason: 'PIN login',
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          displayName: user.display_name,
        },
      };
    }
  }

  throw new ApiError(401, 'Invalid PIN');
}

export function refreshToken(token: string) {
  try {
    const decoded = jwt.verify(token, env.jwt.refreshSecret) as unknown as {
      sub: number;
      username: string;
      role: Role;
      displayName: string;
    };
    const payload = {
      sub: decoded.sub,
      username: decoded.username,
      role: decoded.role,
      displayName: decoded.displayName,
    };
    const accessToken = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
    return { accessToken, user: payload };
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }
}

export async function logout(userId: number, req: Request) {
  await auditLog({
    userId,
    action: AuditAction.Logout,
    entity: 'user',
    entityId: userId,
    req,
  });
}
