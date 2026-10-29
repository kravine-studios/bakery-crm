import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { getSettings, updateSettings, getAuditLog } from './settings.service';

export const updateValidation = [
  body('shopName').optional().isString(),
  body('phone').optional().isString(),
  body('email').optional().isEmail(),
  body('gstin').optional().isString(),
  body('fssaiNumber').optional().isString(),
  body('invoicePrefix').optional().isString(),
  body('invoiceFooter').optional().isString(),
  body('taxInclusive').optional().isBoolean(),
  body('receiptPaper').optional().isIn(['58mm', '80mm', 'A4']),
  body('stockBlockZero').optional().isBoolean(),
  body('loyaltyEnabled').optional().isBoolean(),
  body('loyaltyPointsPerRupee').optional().isFloat({ min: 0 }),
  body('loyaltyMinRedeem').optional().isInt({ min: 0 }),
  validate,
];

export const settingsController = {
  get: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await getSettings());
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await updateSettings({ ...req.body, updatedBy: req.user.id, req }));
  }),

  auditLog: asyncHandler(async (req: Request, res: Response) => {
    res.json(await getAuditLog({
      userId: req.query.userId ? parseInt(req.query.userId as string, 10) : undefined,
      entity: req.query.entity as string | undefined,
      action: req.query.action as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
    }));
  }),
};
