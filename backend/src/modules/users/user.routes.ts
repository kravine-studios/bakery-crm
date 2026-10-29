import { Router } from 'express';
import {
  userController,
  createUserValidation,
  updateUserValidation,
  resetPasswordValidation,
  deactivateValidation,
} from './user.controller';

const router = Router();

router.get('/', userController.list);
router.get('/:id', userController.getById);
router.post('/', createUserValidation, userController.create);
router.put('/:id', updateUserValidation, userController.update);
router.post('/:id/reset-password', resetPasswordValidation, userController.resetPassword);
router.post('/:id/deactivate', deactivateValidation, userController.deactivate);

export default router;
