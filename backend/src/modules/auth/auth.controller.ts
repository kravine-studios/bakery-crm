import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler }  from '../../utils/asyncHandler';
import { validate }      from '../../middleware/validate';
import { Role }          from '../../types/enums';
import {
  ownerLogin, staffLogin, refreshAccessToken, logout,
} from './auth.service';

// ── Validation chains ─────────────────────────────────────────────────────────

export const ownerLoginValidation = [
  body('username').isString().trim().notEmpty().withMessage('Username is required'),
  body('password').isString().isLength({ min: 1 }).withMessage('Password is required'),
  validate,
];

export const staffLoginValidation = [
  body('username').isString().trim().notEmpty().withMessage('Username is required'),
  body('password').isString().isLength({ min: 1 }).withMessage('Password is required'),
  body('role')
    .isIn([Role.Manager, Role.Cashier])
    .withMessage('Role must be manager or cashier'),
  validate,
];

export const refreshTokenValidation = [
  body('refreshToken').isString().notEmpty().withMessage('Refresh token is required'),
  validate,
];

// ── Controller ────────────────────────────────────────────────────────────────

export const authController = {
  /** POST /auth/owner-login — admin role only */
  ownerLogin: asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const result = await ownerLogin(username, password, req);
    res.json(result);
  }),

  /** POST /auth/staff-login — manager or cashier; role must match client selection */
  staffLogin: asyncHandler(async (req: Request, res: Response) => {
    const { username, password, role } = req.body;
    const result = await staffLogin(username, password, role as Role, req);
    res.json(result);
  }),

  /** POST /auth/refresh */
  refresh: asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const result = refreshAccessToken(refreshToken);
    res.json(result);
  }),

  /** POST /auth/logout  (authenticated) */
  logout: asyncHandler(async (req: Request, res: Response) => {
    if (req.user) await logout(req.user.id, req);
    res.json({ message: 'Logged out' });
  }),

  /** GET /auth/me  (authenticated) — never returns password hash */
  me: asyncHandler(async (req: Request, res: Response) => {
    res.json({ user: req.user });
  }),
};
