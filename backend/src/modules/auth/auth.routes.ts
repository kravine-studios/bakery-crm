import { Router } from 'express';
import { authController, loginValidation, pinLoginValidation, refreshTokenValidation } from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.post('/login', loginValidation, authController.login);
router.post('/pin-login', pinLoginValidation, authController.pinLogin);
router.post('/refresh', refreshTokenValidation, authController.refresh);

// Authenticated routes
router.use(authenticate);
router.post('/logout', authController.logout);
router.get('/me', authController.me);

export default router;
