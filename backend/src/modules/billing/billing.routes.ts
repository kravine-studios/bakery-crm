import { Router } from 'express';
import { billingController, createBillValidation, holdBillValidation, cancelBillValidation } from './billing.controller';
import { authorize } from '../../middleware/rbac';
import { Role } from '../../types/enums';

const router = Router();

// All roles can create/hold bills
router.post('/', createBillValidation, billingController.create);
router.post('/hold', holdBillValidation, billingController.hold);
router.get('/', billingController.list);
router.get('/:id', billingController.getById);
router.get('/:id/resume', billingController.resume);
router.post('/:id/print', billingController.print);

// Cancellation: cashier requests, manager/admin approves
router.post('/:id/cancel', cancelBillValidation, billingController.cancel);

export default router;
