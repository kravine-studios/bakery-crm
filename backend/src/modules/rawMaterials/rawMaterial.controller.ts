import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import {
  listRawMaterials, getRawMaterialById, createRawMaterial, updateRawMaterial,
  getLowStockMaterials, getNearExpiryMaterials, setUnitConversion,
} from './rawMaterial.service';

export const createValidation = [
  body('name').isString().trim().notEmpty(),
  body('baseUnit').isString().notEmpty(),
  body('minStockLevel').optional().isFloat({ min: 0 }),
  body('shelfLifeDays').optional().isInt({ min: 0 }),
  body('costMethod').optional().isIn(['avg', 'fifo']),
  validate,
];

export const updateValidation = [
  body('name').optional().isString().trim().notEmpty(),
  body('baseUnit').optional().isString(),
  body('minStockLevel').optional().isFloat({ min: 0 }),
  body('isActive').optional().isBoolean(),
  validate,
];

export const conversionValidation = [
  body('fromUnit').isString().notEmpty(),
  body('toUnit').isString().notEmpty(),
  body('factor').isFloat({ min: 0 }),
  validate,
];

export const rawMaterialController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const materials = await listRawMaterials(includeInactive);
    res.json(materials);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    res.json(await getRawMaterialById(parseInt(req.params.id, 10)));
  }),

  lowStock: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await getLowStockMaterials());
  }),

  nearExpiry: asyncHandler(async (req: Request, res: Response) => {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    res.json(await getNearExpiryMaterials(days));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(201).json(await createRawMaterial({ ...req.body, createdBy: req.user.id, req }));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await updateRawMaterial({ ...req.body, id: parseInt(req.params.id, 10), updatedBy: req.user.id, req }));
  }),

  setConversion: asyncHandler(async (req: Request, res: Response) => {
    res.json(await setUnitConversion({ ...req.body, rawMaterialId: parseInt(req.params.id, 10), req }));
  }),
};
