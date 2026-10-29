import { Router } from 'express';
import { shiftController, openShiftValidation, closeShiftValidation, cashEntryValidation } from './shift.controller';
import { authorize } from '../../middleware/rbac';
import { Role } from '../../types/enums';

const router = Router();

router.post('/open', openShiftValidation, shiftController.open);
router.post('/:id/close', closeShiftValidation, shiftController.close);
router.post('/:id/cash-entries', cashEntryValidation, shiftController.addCashEntry);
router.get('/:id/day-end', authorize(Role.Admin, Role.Manager, Role.Cashier), shiftController.dayEnd);

export default router;
