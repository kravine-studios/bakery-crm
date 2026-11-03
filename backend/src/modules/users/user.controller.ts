import { Request, Response } from 'express';
import { body, param } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate }     from '../../middleware/validate';
import { authorize }    from '../../middleware/rbac';
import { Role }         from '../../types/enums';
import {
  listUsers, getUserById, createUser, updateUser,
  resetPassword, deactivateUser, activateUser, unlockUser,
} from './user.service';

// ── Admin-only guard middleware ───────────────────────────────────────────────
const adminOnly = authorize(Role.Admin);

// ── Validation chains ─────────────────────────────────────────────────────────

export const createUserValidation = [
  body('username').isString().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isString().isLength({ min: 10 }).withMessage('Password must be at least 10 characters'),
  body('role').isIn([Role.Manager, Role.Cashier]).withMessage('Role must be manager or cashier (admin cannot be created here)'),
  body('displayName').isString().trim().notEmpty().withMessage('Display name is required'),
  body('discountLimit').optional().isFloat({ min: 0 }),
  validate,
];

export const updateUserValidation = [
  body('displayName').optional().isString().trim().notEmpty(),
  body('discountLimit').optional().isFloat({ min: 0 }),
  body('isActive').optional().isBoolean(),
  validate,
];

export const resetPasswordValidation = [
  // null means "generate"
  body('newPassword').optional({ nullable: true }).isString().isLength({ min: 10 }),
  validate,
];

// ── Controller ────────────────────────────────────────────────────────────────

export const userController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const requestingRole  = req.user!.role;
    const users = await listUsers(includeInactive, requestingRole);
    res.json(users);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const user = await getUserById(parseInt(req.params.id, 10), req.user!.role);
    res.json(user);
  }),

  create: [
    adminOnly,
    ...createUserValidation,
    asyncHandler(async (req: Request, res: Response) => {
      const user = await createUser({ ...req.body, createdBy: req.user!.id, req });
      res.status(201).json(user);
    }),
  ],

  update: [
    adminOnly,
    ...updateUserValidation,
    asyncHandler(async (req: Request, res: Response) => {
      const user = await updateUser({
        ...req.body,
        id:        parseInt(req.params.id, 10),
        updatedBy: req.user!.id,
        req,
      });
      res.json(user);
    }),
  ],

  resetPassword: [
    adminOnly,
    ...resetPasswordValidation,
    asyncHandler(async (req: Request, res: Response) => {
      const result = await resetPassword(
        parseInt(req.params.id, 10),
        req.body.newPassword ?? null,
        req.user!.id,
        req
      );
      // If generated, return it ONCE. The caller must show it then discard.
      res.json({ message: 'Password reset', ...result });
    }),
  ],

  deactivate: [
    adminOnly,
    asyncHandler(async (req: Request, res: Response) => {
      const reason = req.body.reason ?? 'Deactivated by admin';
      await deactivateUser(parseInt(req.params.id, 10), reason, req.user!.id, req);
      res.json({ message: 'User deactivated' });
    }),
  ],

  activate: [
    adminOnly,
    asyncHandler(async (req: Request, res: Response) => {
      await activateUser(parseInt(req.params.id, 10), req.user!.id, req);
      res.json({ message: 'User activated' });
    }),
  ],

  unlock: [
    adminOnly,
    asyncHandler(async (req: Request, res: Response) => {
      await unlockUser(parseInt(req.params.id, 10), req.user!.id, req);
      res.json({ message: 'User unlocked' });
    }),
  ],
};
