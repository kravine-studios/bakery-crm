import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { WastageReason } from '../../types/enums';
import {
  getFinishedStock, getExpiredStock, getStockMovements, recordWastage, listWastage, stockAdjustment,
} from './stock.service';

export const wastageValidation = [
  body('productId').isInt({ min: 1 }),
  body('quantity').isFloat({ min: 0.001 }),
  body('unit').isString().notEmpty(),
  body('reason').isIn(['expired', 'damaged', 'sampling', 'spillage', 'staff_consumption']),
  validate,
];

export const adjustmentValidation = [
  body('productId').isInt({ min: 1 }),
  body('adjustmentQuantity').isFloat(),
  body('unit').isString().notEmpty(),
  body('reason').isString().trim().notEmpty(),
  validate,
];

export const stockController = {
  finished: asyncHandler(async (req: Request, res: Response) => {
    res.json(await getFinishedStock({
      productId: req.query.productId ? parseInt(req.query.productId as string, 10) : undefined,
      nearExpiry: req.query.nearExpiry === 'true',
    }));
  }),

  expired: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await getExpiredStock());
  }),

  movements: asyncHandler(async (req: Request, res: Response) => {
    res.json(await getStockMovements({
      productId: req.query.productId ? parseInt(req.query.productId as string, 10) : undefined,
      batchId: req.query.batchId ? parseInt(req.query.batchId as string, 10) : undefined,
      type: req.query.type as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
    }));
  }),

  wastage: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(201).json(await recordWastage({
      ...req.body,
      reason: req.body.reason as WastageReason,
      approvedBy: req.user.id,
      req,
    }));
  }),

  listWastage: asyncHandler(async (req: Request, res: Response) => {
    res.json(await listWastage({
      productId: req.query.productId ? parseInt(req.query.productId as string, 10) : undefined,
      reason: req.query.reason as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    }));
  }),

  adjust: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(201).json(await stockAdjustment({
      ...req.body,
      adjustedBy: req.user.id,
      req,
    }));
  }),
};
