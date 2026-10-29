import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { ExpenseCategory } from '../../types/enums';
import { listExpenses, createExpense, getExpenseSummary } from './expense.service';

export const createValidation = [
  body('category').isIn(['electricity', 'rent', 'salaries', 'gas', 'packaging', 'transport', 'repairs', 'others']),
  body('amount').isFloat({ min: 0.01 }),
  body('paymentMode').optional().isIn(['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'wallet']),
  validate,
];

export const expenseController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    res.json(await listExpenses({
      category: req.query.category as ExpenseCategory | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    }));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(201).json(await createExpense({
      ...req.body,
      category: req.body.category as ExpenseCategory,
      createdBy: req.user.id,
      req,
    }));
  }),

  summary: asyncHandler(async (req: Request, res: Response) => {
    const dateFrom = req.query.dateFrom as string || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const dateTo = req.query.dateTo as string || new Date().toISOString().split('T')[0];
    res.json(await getExpenseSummary(dateFrom, dateTo));
  }),
};
