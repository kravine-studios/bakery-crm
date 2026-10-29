import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import { Role } from '../types/enums';

export interface JwtPayload {
  sub: number;        // user id
  username: string;
  role: Role;
  displayName: string;
  shiftId?: number;
}

/**
 * Verify the Bearer token and attach `req.user`.
 * If the token is missing or invalid, respond 401.
 */
export const authenticate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, env.jwt.secret) as JwtPayload;
    req.user = {
      id: decoded.sub,
      username: decoded.username,
      role: decoded.role,
      displayName: decoded.displayName,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

/**
 * Optional authentication — attach user if token present, but do not
 * reject when missing. Useful for public endpoints that behave
 * differently for logged-in users.
 */
export const optionalAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), env.jwt.secret) as JwtPayload;
      req.user = {
        id: decoded.sub,
        username: decoded.username,
        role: decoded.role,
        displayName: decoded.displayName,
      };
    } catch {
      // Ignore invalid token on optional auth
    }
  }
  next();
});
