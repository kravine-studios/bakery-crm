import { Request, Response } from 'express';
import { body, query } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { Role } from '../../types/enums';
import {
  listUsers, getUserById, createUser, updateUser, resetPassword, deactivateUser,
} from './user.service';

export const createUserValidation = [
  body('username').isString().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'manager', 'cashier']).withMessage('Invalid role'),
  body('displayName').isString().trim().notEmpty().withMessage('Display name is required'),
  body('pin').optional().isString().isLength({ min: 4, max: 6 }),
  body('discountLimit').optional().isFloat({ min: 0 }),
  validate,
];

export const updateUserValidation = [
  body('displayName').optional().isString().trim().notEmpty(),
  body('pin').optional().isString().isLength({ min: 4, max: 6 }),
  body('discountLimit').optional().isFloat({ min: 0 }),
  body('role').optional().isIn(['admin', 'manager', 'cashier']),
  validate,
];

export const resetPasswordValidation = [
  body('newPassword').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
];

export const deactivateValidation = [
  body('reason').isString().trim().notEmpty().withMessage('Reason is required'),
  validate,
];

export const userController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const users = await listUsers(includeInactive);
    res.json(users);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const user = await getUserById(parseInt(req.params.id, 10));
    res.json(user);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const user = await createUser({
      username: req.body.username,
      password: req.body.password,
      role: req.body.role as Role,
      displayName: req.body.displayName,
      pin: req.body.pin,
      discountLimit: req.body.discountLimit,
      createdBy: req.user.id,
      req,
    });
    res.status(201).json(user);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const user = await updateUser({
      id: parseInt(req.params.id, 10),
      displayName: req.body.displayName,
      pin: req.body.pin,
      discountLimit: req.body.discountLimit,
      role: req.body.role as Role,
      updatedBy: req.user.id,
      req,
    });
    res.json(user);
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    await resetPassword(parseInt(req.params.id, 10), req.body.newPassword, req.user.id, req);
    res.json({ message: 'Password reset successfully' });
  }),

  deactivate: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    await deactivateUser(parseInt(req.params.id, 10), req.body.reason, req.user.id, req);
    res.json({ message: 'User deactivated' });
  }),
};
