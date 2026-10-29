import { Router } from 'express';
import { recipeController, createValidation } from './recipe.controller';

const router = Router();

router.get('/', recipeController.list);
router.get('/:id', recipeController.getById);
router.post('/', createValidation, recipeController.create);

export default router;
