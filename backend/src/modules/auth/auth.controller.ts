import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { login, pinLogin, refreshToken, logout } from './auth.service';

export const loginValidation = [
  body('username').isString().trim().notEmpty().withMessage('Username is required'),
  body('password').isString().isLength({ min: 1 }).withMessage('Password is required'),
  validate,
];

export const pinLoginValidation = [
  body('pin').isString().isLength({ min: 4, max: 6 }).withMessage('PIN must be 4-6 digits'),
  validate,
];

export const refreshTokenValidation = [
  body('refreshToken').isString().notEmpty().withMessage('Refresh token is required'),
  validate,
];

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const result = await login(username, password, req);
    res.json(result);
  }),

  pinLogin: asyncHandler(async (req: Request, res: Response) => {
    const { pin } = req.body;
    const result = await pinLogin(pin, req);
    res.json(result);
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken: token } = req.body;
    const result = refreshToken(token);
    res.json(result);
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    if (req.user) {
      await logout(req.user.id, req);
    }
    res.json({ message: 'Logged out' });
  }),

  // Return the currently authenticated user's info
  me: asyncHandler(async (req: Request, res: Response) => {
    res.json({ user: req.user });
  }),
};
