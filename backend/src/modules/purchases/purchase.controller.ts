import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { createReceipt, listReceipts, getReceiptById, createPayment, createPurchaseOrder } from './purchase.service';

export const createReceiptValidation = [
  body('supplierId').isInt({ min: 1 }),
  body('items').isArray({ min: 1 }),
  body('items.*.rawMaterialId').isInt({ min: 1 }),
  body('items.*.quantityReceived').isFloat({ min: 0.001 }),
  body('items.*.unit').isString(),
  body('items.*.rate').isFloat({ min: 0 }),
  body('items.*.gstRate').isFloat({ min: 0, max: 100 }),
  validate,
];

export const paymentValidation = [
  body('supplierId').isInt({ min: 1 }),
  body('amount').isFloat({ min: 0.01 }),
  body('paymentMode').isIn(['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'wallet']),
  validate,
];

export const poValidation = [
  body('supplierId').isInt({ min: 1 }),
  body('expectedDate').optional().isISO8601(),
  validate,
];

export const purchaseController = {
  createReceipt: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(201).json(await createReceipt({ ...req.body, receivedBy: req.user.id, req }));
  }),

  listReceipts: asyncHandler(async (req: Request, res: Response) => {
    res.json(await listReceipts({
      supplierId: req.query.supplierId ? parseInt(req.query.supplierId as string, 10) : undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    }));
  }),

  getReceipt: asyncHandler(async (req: Request, res: Response) => {
    res.json(await getReceiptById(parseInt(req.params.id, 10)));
  }),

  createPayment: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(201).json(await createPayment({ ...req.body, createdBy: req.user.id, req }));
  }),

  createPO: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(201).json(await createPurchaseOrder({ ...req.body, createdBy: req.user.id, req }));
  }),
};
