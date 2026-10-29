import { Router } from 'express';
import { categoryController, createCategoryValidation, updateCategoryValidation } from './category.controller';

const router = Router();

router.get('/', categoryController.list);
router.get('/:id', categoryController.getById);
router.post('/', createCategoryValidation, categoryController.create);
router.put('/:id', updateCategoryValidation, categoryController.update);

export default router;
