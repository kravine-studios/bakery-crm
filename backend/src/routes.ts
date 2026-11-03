/**
 * Root API router.
 *
 * Permission model (enforced HERE and on each sub-router):
 *   Admin   — all routes
 *   Manager — VIEW all + CREATE bills/orders/customers + update order status
 *   Cashier — billing, customers, orders (own), shifts (own only)
 *
 * Mutation routes (PUT/PATCH/DELETE) that go beyond the above
 * are individually guarded by requireAdmin() in each sub-router.
 */

import { Router } from 'express';
import { authenticate } from './middleware/auth';
import { authorize }    from './middleware/rbac';
import { Role }         from './types/enums';

import authRoutes         from './modules/auth/auth.routes';
import userRoutes         from './modules/users/user.routes';
import categoryRoutes     from './modules/categories/category.routes';
import productRoutes      from './modules/products/product.routes';
import supplierRoutes     from './modules/suppliers/supplier.routes';
import rawMaterialRoutes  from './modules/rawMaterials/rawMaterial.routes';
import purchaseRoutes     from './modules/purchases/purchase.routes';
import recipeRoutes       from './modules/recipes/recipe.routes';
import productionRoutes   from './modules/production/production.routes';
import stockRoutes        from './modules/stock/stock.routes';
import billingRoutes      from './modules/billing/billing.routes';
import customerRoutes     from './modules/customers/customer.routes';
import orderRoutes        from './modules/orders/order.routes';
import shiftRoutes        from './modules/shifts/shift.routes';
import expenseRoutes      from './modules/expenses/expense.routes';
import reportRoutes       from './modules/reports/report.routes';
import settingsRoutes     from './modules/settings/settings.routes';
import notificationRoutes from './modules/notifications/notifications.routes';

const router = Router();

// ── Public auth routes (no authenticate middleware) ───────────────────────────
router.use('/auth', authRoutes);

// ── All routes below require a valid JWT ─────────────────────────────────────
router.use(authenticate);

// ── User management (admin = full CRUD; manager = read-only via sub-router) ──
router.use('/users',        authorize(Role.Admin, Role.Manager), userRoutes);

// ── Catalog / stock (admin + manager VIEW; mutations require admin in sub-router)
router.use('/categories',   authorize(Role.Admin, Role.Manager), categoryRoutes);
router.use('/products',     productRoutes);                        // cashier can view for billing
router.use('/suppliers',    authorize(Role.Admin, Role.Manager), supplierRoutes);
router.use('/raw-materials',authorize(Role.Admin, Role.Manager), rawMaterialRoutes);
router.use('/purchases',    authorize(Role.Admin, Role.Manager), purchaseRoutes);
router.use('/recipes',      authorize(Role.Admin, Role.Manager), recipeRoutes);
router.use('/production',   authorize(Role.Admin, Role.Manager), productionRoutes);
router.use('/stock',        authorize(Role.Admin, Role.Manager), stockRoutes);

// ── Sales (all roles; per-role restrictions inside each sub-router) ───────────
router.use('/billing',      billingRoutes);
router.use('/customers',    customerRoutes);
router.use('/orders',       orderRoutes);   // cashier: view+create+status only
router.use('/shifts',       shiftRoutes);   // cashier: own shift only

// ── Finance (admin + manager view; mutations require admin in sub-router) ─────
router.use('/expenses',     authorize(Role.Admin, Role.Manager), expenseRoutes);
router.use('/reports',      authorize(Role.Admin, Role.Manager), reportRoutes);

// ── Admin only ────────────────────────────────────────────────────────────────
router.use('/settings',     authorize(Role.Admin), settingsRoutes);

// ── Shared / open to all authenticated ───────────────────────────────────────
router.use('/notifications', notificationRoutes);

export default router;
