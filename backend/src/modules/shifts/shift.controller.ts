import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { CashEntryType } from '../../types/enums';
import { openShift, closeShift, addCashEntry, getDayEndReport } from './shift.service';

export const openShiftValidation = [
  body('openingFloat').isFloat({ min: 0 }),
  validate,
];

export const closeShiftValidation = [
  body('countedCash').isFloat({ min: 0 }),
  body('notes').optional().isString(),
  validate,
];

export const cashEntryValidation = [
  body('entryType').isIn(['cash_in', 'cash_out']),
  body('amount').isFloat({ min: 0.01 }),
  body('reason').optional().isString(),
  validate,
];

export const shiftController = {
  open: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(201).json(await openShift({ cashierId: req.user.id, openingFloat: req.body.openingFloat, req }));
  }),

  close: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await closeShift({
      shiftId: parseInt(req.params.id, 10),
      countedCash: req.body.countedCash,
      notes: req.body.notes,
      closedBy: req.user.id,
      req,
    }));
  }),

  addCashEntry: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(201).json(await addCashEntry({
      shiftId: parseInt(req.params.id, 10),
      entryType: req.body.entryType as CashEntryType,
      amount: req.body.amount,
      reason: req.body.reason,
      referenceType: req.body.referenceType,
      referenceId: req.body.referenceId,
      createdBy: req.user.id,
      req,
    }));
  }),

  dayEnd: asyncHandler(async (req: Request, res: Response) => {
    res.json(await getDayEndReport(parseInt(req.params.id, 10)));
  }),
};
