import { Router } from 'express';
import { supplierController, createSupplierValidation, updateSupplierValidation } from './supplier.controller';

const router = Router();

router.get('/', supplierController.list);
router.get('/:id', supplierController.getById);
router.get('/:id/balance', supplierController.getBalance);
router.get('/:id/history', supplierController.getHistory);
router.post('/', createSupplierValidation, supplierController.create);
router.put('/:id', updateSupplierValidation, supplierController.update);

export default router;
