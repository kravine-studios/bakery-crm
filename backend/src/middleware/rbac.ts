import { Request, Response, NextFunction } from 'express';
import { Role, ROLE_RANK } from '../types/enums';

/**
 * Allow access only if the caller's role is in the provided list.
 * Must run AFTER authenticate middleware.
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'You do not have permission to perform this action' });
      return;
    }
    next();
  };
}

/**
 * Allow access if the caller's rank is >= the minimum role.
 * Admin(3) > Manager(2) > Cashier(1).
 */
export function requireMinRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) {
      res.status(403).json({ error: 'Insufficient role for this action' });
      return;
    }
    next();
  };
}

/**
 * Allow access if the caller is the owner of the resource (same user id)
 * OR has the minimum role. Useful for "own or manager" scenarios.
 */
export function ownOrManager(getResourceId: (req: Request) => number, minRole: Role = Role.Manager) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (req.user.id === getResourceId(req) || ROLE_RANK[req.user.role] >= ROLE_RANK[minRole]) {
      next();
      return;
    }
    res.status(403).json({ error: 'You can only access your own resources' });
  };
}
