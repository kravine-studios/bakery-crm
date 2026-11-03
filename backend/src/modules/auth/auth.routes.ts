import { Router }         from 'express';
import rateLimit          from 'express-rate-limit';
import { authController, ownerLoginValidation, staffLoginValidation, refreshTokenValidation } from './auth.controller';
import { authenticate }   from '../../middleware/auth';

const router = Router();

// Stricter per-endpoint rate limit (belt-and-suspenders on top of the global one in routes.ts)
const loginRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max:      20,               // absolute ceiling per IP before the DB lockout kicks in
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login requests from this IP. Try again later.' },
});

// ── Public endpoints ──────────────────────────────────────────────────────────
router.post('/owner-login', loginRateLimit, ownerLoginValidation, authController.ownerLogin);
router.post('/staff-login', loginRateLimit, staffLoginValidation,  authController.staffLogin);
router.post('/refresh',     refreshTokenValidation, authController.refresh);

// ── Authenticated endpoints ───────────────────────────────────────────────────
router.use(authenticate);
router.post('/logout', authController.logout);
router.get('/me',      authController.me);

export default router;
