import { Router } from 'express';
import { productController, createProductValidation, updateProductValidation, createVariantValidation } from './product.controller';
import { authorize } from '../../middleware/rbac';
import { Role } from '../../types/enums';

const router = Router();

// All cashiers can view and code-lookup products
router.get('/',                    productController.list);
router.get('/by-code/:code',       productController.getByCode);   // billing code-entry lookup
router.get('/:id',                 productController.getById);
router.get('/:id/variants',        productController.getVariants);
router.get('/:id/price-history',   productController.getPriceHistory);

router.post('/',            authorize(Role.Admin, Role.Manager), createProductValidation, productController.create);
router.put('/:id',          authorize(Role.Admin, Role.Manager), updateProductValidation, productController.update);
router.post('/:id/variants',authorize(Role.Admin, Role.Manager), createVariantValidation, productController.createVariant);

export default router;
