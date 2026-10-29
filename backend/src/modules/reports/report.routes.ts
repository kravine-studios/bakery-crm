import { Router } from 'express';
import { reportController } from './report.controller';
import { authorize } from '../../middleware/rbac';
import { Role } from '../../types/enums';

const router = Router();

// Admin-only financial reports
router.get('/sales/summary', reportController.salesSummary);
router.get('/sales/by-product', reportController.salesByProduct);
router.get('/sales/by-payment-mode', reportController.salesByPaymentMode);
router.get('/sales/by-cashier', authorize(Role.Admin), reportController.salesByCashier);
router.get('/sales/by-hour', reportController.salesByHour);
router.get('/stock-valuation', authorize(Role.Admin), reportController.stockValuation);
router.get('/gst', authorize(Role.Admin), reportController.gst);
router.get('/wastage', reportController.wastage);
router.get('/production', reportController.production);
router.get('/profit', authorize(Role.Admin), reportController.profit);

export default router;
