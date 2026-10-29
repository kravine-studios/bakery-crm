import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { validate } from './middleware/validate';
import { authenticate } from './middleware/auth';
import { authorize } from './middleware/rbac';
import { Role } from './types/enums';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import categoryRoutes from './modules/categories/category.routes';
import productRoutes from './modules/products/product.routes';
import supplierRoutes from './modules/suppliers/supplier.routes';
import rawMaterialRoutes from './modules/rawMaterials/rawMaterial.routes';
import purchaseRoutes from './modules/purchases/purchase.routes';
import recipeRoutes from './modules/recipes/recipe.routes';
import productionRoutes from './modules/production/production.routes';
import stockRoutes from './modules/stock/stock.routes';
import billingRoutes from './modules/billing/billing.routes';
import customerRoutes from './modules/customers/customer.routes';
import orderRoutes from './modules/orders/order.routes';
import shiftRoutes from './modules/shifts/shift.routes';
import expenseRoutes from './modules/expenses/expense.routes';
import reportRoutes from './modules/reports/report.routes';
import settingsRoutes from './modules/settings/settings.routes';
import notificationRoutes from './modules/notifications/notifications.routes';

const router = Router();

// Stricter rate limit on login endpoint
const loginLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.loginMax,
  message: { error: 'Too many login attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.use('/auth/login', loginLimiter);
router.use('/auth', authRoutes);

// All routes below require authentication
router.use(authenticate);

router.use('/users', authorize(Role.Admin, Role.Manager), userRoutes);
router.use('/categories', authorize(Role.Admin, Role.Manager), categoryRoutes);
router.use('/products', productRoutes);
router.use('/suppliers', authorize(Role.Admin, Role.Manager), supplierRoutes);
router.use('/raw-materials', authorize(Role.Admin, Role.Manager), rawMaterialRoutes);
router.use('/purchases', authorize(Role.Admin, Role.Manager), purchaseRoutes);
router.use('/recipes', authorize(Role.Admin, Role.Manager), recipeRoutes);
router.use('/production', authorize(Role.Admin, Role.Manager), productionRoutes);
router.use('/stock', authorize(Role.Admin, Role.Manager), stockRoutes);
router.use('/billing', billingRoutes);
router.use('/customers', customerRoutes);
router.use('/orders', authorize(Role.Admin, Role.Manager), orderRoutes);
router.use('/shifts', shiftRoutes);
router.use('/expenses', authorize(Role.Admin, Role.Manager), expenseRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', authorize(Role.Admin), settingsRoutes);
router.use('/notifications', notificationRoutes);

export default router;
