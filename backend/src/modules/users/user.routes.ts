import { Router } from 'express';
import { userController } from './user.controller';

const router = Router();

// List / get (admin sees fingerprint, manager sees table read-only)
router.get('/',       userController.list);
router.get('/:id',    userController.getById);

// All mutation routes are admin-only (enforced inside each controller action)
router.post('/',                    userController.create);
router.put('/:id',                  userController.update);
router.post('/:id/reset-password',  userController.resetPassword);
router.post('/:id/deactivate',      userController.deactivate);
router.post('/:id/activate',        userController.activate);
router.post('/:id/unlock',          userController.unlock);

export default router;
