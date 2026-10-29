import { Router } from 'express';
import { customerController, createValidation, updateValidation } from './customer.controller';

const router = Router();

router.get('/', customerController.list);
router.get('/find', customerController.findByPhone);
router.get('/:id', customerController.getById);
router.get('/:id/history', customerController.history);
router.post('/', createValidation, customerController.create);
router.put('/:id', updateValidation, customerController.update);

export default router;
