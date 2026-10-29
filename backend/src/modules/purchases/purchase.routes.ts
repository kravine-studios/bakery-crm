import { Router } from 'express';
import { purchaseController, createReceiptValidation, paymentValidation, poValidation } from './purchase.controller';

const router = Router();

router.get('/receipts', purchaseController.listReceipts);
router.get('/receipts/:id', purchaseController.getReceipt);
router.post('/receipts', createReceiptValidation, purchaseController.createReceipt);

router.post('/payments', paymentValidation, purchaseController.createPayment);

router.post('/po', poValidation, purchaseController.createPO);

export default router;
