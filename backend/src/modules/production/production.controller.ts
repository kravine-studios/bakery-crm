import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { BatchStatus } from '../../types/enums';
import { createBatch, completeBatch, listBatches, getBatchById, getBatchTraceability } from './production.service';

export const createBatchValidation = [
  body('productId').isInt({ min: 1 }),
  body('recipeId').isInt({ min: 1 }),
  body('plannedQuantity').isFloat({ min: 0.001 }),
  body('unit').isString().notEmpty(),
  body('supervisedBy').isInt({ min: 1 }),
  body('shiftId').optional().isInt({ min: 1 }),
  body('notes').optional().isString(),
  body('materialUsage').optional().isArray(),
  validate,
];

export const completeBatchValidation = [
  body('actualQuantity').isFloat({ min: 0 }),
  validate,
];

export const productionController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const result = await createBatch({
      ...req.body,
      createdBy: req.user.id,
      req,
    });
    res.status(201).json(result);
  }),

  complete: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const result = await completeBatch({
      batchId: parseInt(req.params.id, 10),
      actualQuantity: req.body.actualQuantity,
      updatedBy: req.user.id,
      req,
    });
    res.json(result);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      status: req.query.status as BatchStatus | undefined,
      productId: req.query.productId ? parseInt(req.query.productId as string, 10) : undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };
    const batches = await listBatches(filters);
    res.json(batches);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const batch = await getBatchById(parseInt(req.params.id, 10));
    res.json(batch);
  }),

  traceability: asyncHandler(async (req: Request, res: Response) => {
    const result = await getBatchTraceability(parseInt(req.params.id, 10));
    res.json(result);
  }),
};
