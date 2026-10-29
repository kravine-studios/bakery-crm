import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { listCategories, getCategoryById, createCategory, updateCategory } from './category.service';

export const createCategoryValidation = [
  body('name').isString().trim().notEmpty().withMessage('Category name is required'),
  body('parentId').optional().isInt({ min: 1 }),
  body('sortOrder').optional().isInt({ min: 0 }),
  validate,
];

export const updateCategoryValidation = [
  body('name').optional().isString().trim().notEmpty(),
  body('parentId').optional().isInt({ min: 1 }),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
  validate,
];

export const categoryController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const categories = await listCategories(includeInactive);
    res.json(categories);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const category = await getCategoryById(parseInt(req.params.id, 10));
    res.json(category);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const category = await createCategory({
      name: req.body.name,
      parentId: req.body.parentId,
      sortOrder: req.body.sortOrder,
      createdBy: req.user.id,
      req,
    });
    res.status(201).json(category);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const category = await updateCategory({
      id: parseInt(req.params.id, 10),
      name: req.body.name,
      parentId: req.body.parentId,
      sortOrder: req.body.sortOrder,
      isActive: req.body.isActive,
      updatedBy: req.user.id,
      req,
    });
    res.json(category);
  }),
};
