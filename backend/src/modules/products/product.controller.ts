import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import {
  listProducts, getProductById, getProductVariants, createProduct, updateProduct,
  createVariant, getPriceHistory, getProductByCode,
} from './product.service';

export const createProductValidation = [
  body('name').isString().trim().notEmpty().withMessage('Product name is required'),
  body('categoryId').isInt({ min: 1 }).withMessage('Valid category is required'),
  body('productType').isIn(['produced', 'traded']).withMessage('Type must be produced or traded'),
  body('productCode').optional().isString().trim().isLength({ min: 1, max: 10 }),
  body('gstRate').isFloat({ min: 0, max: 100 }),
  body('sellingUnit').isIn(['piece', 'kg', 'gram', 'box', 'dozen', 'litre', 'ml', 'packet']),
  body('sellingPrice').isFloat({ min: 0 }),
  body('costPrice').isFloat({ min: 0 }),
  body('sku').optional().isString(),
  body('hsnCode').optional().isString(),
  body('mrp').optional().isFloat({ min: 0 }),
  body('isWeighed').optional().isBoolean(),
  body('foodType').optional().isIn(['veg', 'non_veg', 'egg']),
  body('shelfLifeDays').optional().isInt({ min: 0 }),
  validate,
];

export const updateProductValidation = [
  body('name').optional().isString().trim().notEmpty(),
  body('categoryId').optional().isInt({ min: 1 }),
  body('gstRate').optional().isFloat({ min: 0, max: 100 }),
  body('sellingUnit').optional().isIn(['piece', 'kg', 'gram', 'box', 'dozen', 'litre', 'ml', 'packet']),
  body('sellingPrice').optional().isFloat({ min: 0 }),
  body('costPrice').optional().isFloat({ min: 0 }),
  body('mrp').optional().isFloat({ min: 0 }),
  body('isWeighed').optional().isBoolean(),
  body('foodType').optional().isIn(['veg', 'non_veg', 'egg']),
  body('shelfLifeDays').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
  validate,
];

export const createVariantValidation = [
  body('name').isString().trim().notEmpty(),
  body('unit').isString().notEmpty(),
  body('sellingPrice').isFloat({ min: 0 }),
  body('costPrice').isFloat({ min: 0 }),
  body('weightValue').optional().isFloat({ min: 0 }),
  body('mrp').optional().isFloat({ min: 0 }),
  validate,
];

export const productController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string, 10) : undefined,
      search: req.query.search as string | undefined,
      isActive: req.query.active !== undefined ? req.query.active === 'true' : undefined,
    };
    const products = await listProducts(filters);
    res.json(products);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const product = await getProductById(parseInt(req.params.id, 10));
    res.json(product);
  }),

  /** GET /products/by-code/:code — fast lookup by product code for billing. */
  getByCode: asyncHandler(async (req: Request, res: Response) => {
    const product = await getProductByCode(req.params.code);
    if (!product) {
      res.status(404).json({ error: `No active product found for code "${req.params.code}"` });
      return;
    }
    res.json(product);
  }),

  getVariants: asyncHandler(async (req: Request, res: Response) => {
    const variants = await getProductVariants(parseInt(req.params.id, 10));
    res.json(variants);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const product = await createProduct({ ...req.body, createdBy: req.user.id, req });
    res.status(201).json(product);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const product = await updateProduct({ ...req.body, id: parseInt(req.params.id, 10), updatedBy: req.user.id, req });
    res.json(product);
  }),

  createVariant: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const variant = await createVariant({
      ...req.body,
      productId: parseInt(req.params.id, 10),
      createdBy: req.user.id,
      req,
    });
    res.status(201).json(variant);
  }),

  getPriceHistory: asyncHandler(async (req: Request, res: Response) => {
    const history = await getPriceHistory(parseInt(req.params.id, 10));
    res.json(history);
  }),
};
