import { Router } from 'express';
import { productionController, createBatchValidation, completeBatchValidation } from './production.controller';

const router = Router();

router.get('/', productionController.list);
router.get('/:id', productionController.getById);
router.get('/:id/traceability', productionController.traceability);
router.post('/', createBatchValidation, productionController.create);
router.post('/:id/complete', completeBatchValidation, productionController.complete);

export default router;
