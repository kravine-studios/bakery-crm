import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { listRecipes, getRecipeById, createRecipe } from './recipe.service';

export const createValidation = [
  body('productId').isInt({ min: 1 }),
  body('name').isString().trim().notEmpty(),
  body('batchSize').isFloat({ min: 0.001 }),
  body('batchUnit').isString().notEmpty(),
  body('expectedYield').isFloat({ min: 0.001 }),
  body('yieldUnit').isString().notEmpty(),
  body('items').isArray({ min: 1 }),
  body('items.*.rawMaterialId').isInt({ min: 1 }),
  body('items.*.quantity').isFloat({ min: 0.001 }),
  body('items.*.unit').isString().notEmpty(),
  validate,
];

export const recipeController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const productId = req.query.productId ? parseInt(req.query.productId as string, 10) : undefined;
    res.json(await listRecipes(productId));
  }),
  getById: asyncHandler(async (req: Request, res: Response) => {
    res.json(await getRecipeById(parseInt(req.params.id, 10)));
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(201).json(await createRecipe({ ...req.body, createdBy: req.user.id, req }));
  }),
};
