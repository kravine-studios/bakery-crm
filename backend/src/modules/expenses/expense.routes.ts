import { Router } from 'express';
import { expenseController, createValidation } from './expense.controller';

const router = Router();

router.get('/', expenseController.list);
router.get('/summary', expenseController.summary);
router.post('/', createValidation, expenseController.create);

export default router;
