import { Router } from 'express';
import { orderController, createValidation, statusValidation } from './order.controller';

const router = Router();

router.get('/', orderController.list);
router.get('/production-sheet', orderController.productionSheet);
router.get('/:id', orderController.getById);
router.post('/', createValidation, orderController.create);
router.put('/:id/status', statusValidation, orderController.updateStatus);

export default router;
