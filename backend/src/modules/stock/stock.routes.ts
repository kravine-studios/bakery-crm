import { Router } from 'express';
import { stockController, wastageValidation, adjustmentValidation } from './stock.controller';

const router = Router();

router.get('/finished', stockController.finished);
router.get('/expired', stockController.expired);
router.get('/movements', stockController.movements);
router.get('/wastage', stockController.listWastage);
router.post('/wastage', wastageValidation, stockController.wastage);
router.post('/adjust', adjustmentValidation, stockController.adjust);

export default router;
