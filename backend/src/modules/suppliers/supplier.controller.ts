import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { listSuppliers, getSupplierById, getSupplierBalance, createSupplier, updateSupplier, getSupplierHistory } from './supplier.service';

export const createSupplierValidation = [
  body('name').isString().trim().notEmpty().withMessage('Supplier name is required'),
  body('phone').optional().isString(),
  body('email').optional().isEmail(),
  body('gstin').optional().isString(),
  body('openingBalance').optional().isFloat(),
  validate,
];

export const updateSupplierValidation = [
  body('name').optional().isString().trim().notEmpty(),
  body('phone').optional().isString(),
  body('email').optional().isEmail(),
  body('gstin').optional().isString(),
  body('isActive').optional().isBoolean(),
  validate,
];

export const supplierController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const suppliers = await listSuppliers(includeInactive);
    res.json(suppliers);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const supplier = await getSupplierById(parseInt(req.params.id, 10));
    res.json(supplier);
  }),

  getBalance: asyncHandler(async (req: Request, res: Response) => {
    const balance = await getSupplierBalance(parseInt(req.params.id, 10));
    res.json(balance);
  }),

  getHistory: asyncHandler(async (req: Request, res: Response) => {
    const history = await getSupplierHistory(parseInt(req.params.id, 10));
    res.json(history);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const supplier = await createSupplier({ ...req.body, createdBy: req.user.id, req });
    res.status(201).json(supplier);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const supplier = await updateSupplier({ ...req.body, id: parseInt(req.params.id, 10), updatedBy: req.user.id, req });
    res.json(supplier);
  }),
};
