import { Router } from 'express';
import { rawMaterialController, createValidation, updateValidation, conversionValidation } from './rawMaterial.controller';

const router = Router();

router.get('/', rawMaterialController.list);
router.get('/low-stock', rawMaterialController.lowStock);
router.get('/near-expiry', rawMaterialController.nearExpiry);
router.get('/:id', rawMaterialController.getById);
router.post('/', createValidation, rawMaterialController.create);
router.put('/:id', updateValidation, rawMaterialController.update);
router.post('/:id/conversions', conversionValidation, rawMaterialController.setConversion);

export default router;
