/**
 * API index — the single layer between UI components and data.
 *
 * When USE_MOCK is true (VITE_MOCK=true or VITE_DEMO_MODE=true):
 *   ALL operations — including creates, updates and deletes — go through
 *   demoStore, which persists to localStorage so data survives refreshes.
 *
 * When USE_MOCK is false:
 *   All operations call the real Express backend via axios.
 */

import api, { mockResponse, IS_MOCK, IS_DEMO } from './client';
import * as ds from '../store/demoStore';

const USE_MOCK = IS_MOCK || IS_DEMO;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  ownerLogin: (username: string, password: string) => {
    if (USE_MOCK) {
      const settings = ds.settings.get();
      return mockResponse({
        accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token',
        user: { id: 1, username, role: 'admin' as const, displayName: settings.shopName || 'Shop Owner' },
      });
    }
    return api.post('/auth/owner-login', { username, password });
  },
  staffLogin: (username: string, password: string, role: string) => {
    if (USE_MOCK) {
      const allUsers = ds.users.list(true);
      const match = allUsers.find((u) => u.username === username && u.role === role);
      if (match) {
        const perms = match.permissions ?? ds.getDefaultPermissions(match.role);
        return mockResponse({ accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token', user: { ...match, permissions: perms } });
      }
      // Default fallback
      const demoUser = role === 'manager'
        ? { id: 2, username, role: 'manager' as const, displayName: 'Sunita Sharma', permissions: ds.getDefaultPermissions('manager') }
        : { id: 3, username, role: 'cashier' as const, displayName: 'Demo Cashier', permissions: ds.getDefaultPermissions('cashier') };
      return mockResponse({ accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token', user: demoUser });
    }
    return api.post('/auth/staff-login', { username, password, role });
  },
  me: () => {
    if (USE_MOCK) {
      const settings = ds.settings.get();
      const admin = ds.users.list(true).find((u) => u.role === 'admin') ?? null;
      const perms = ds.getAllPermissionsTrue();
      return mockResponse({ user: { id: 1, username: 'admin', role: 'admin' as const, displayName: settings.shopName || 'Shop Owner', permissions: perms } });
    }
    return api.get('/auth/me');
  },
  logout: () => {
    if (USE_MOCK) return mockResponse({ message: 'ok' });
    return api.post('/auth/logout');
  },
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productApi = {
  list:        (params?: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.products.list(params)) : api.get('/products', { params }),
  getById:     (id: number) =>                       USE_MOCK ? mockResponse(ds.products.get(id))      : api.get(`/products/${id}`),
  getByCode:   (code: string) => {
    if (USE_MOCK) {
      const p = ds.products.getByCode(code);
      if (p) return mockResponse(p);
      return Promise.reject({ response: { status: 404, data: { error: `No product found for code "${code}"` } } });
    }
    return api.get(`/products/by-code/${encodeURIComponent(code)}`);
  },
  create:      (data: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.products.create(data))           : api.post('/products', data),
  update:      (id: number, data: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.products.update(id, data)) : api.put(`/products/${id}`, data),
  delete:      (id: number) => USE_MOCK ? mockResponse(ds.products.delete(id)) : api.delete(`/products/${id}`),
  getVariants: (id: number) => USE_MOCK ? mockResponse([])  : api.get(`/products/${id}/variants`),
  createVariant:(id: number, data: Record<string, unknown>) => USE_MOCK ? mockResponse({}) : api.post(`/products/${id}/variants`, data),
  getPriceHistory:(id: number) => USE_MOCK ? mockResponse([]) : api.get(`/products/${id}/price-history`),
};

// ── Categories ────────────────────────────────────────────────────────────────
export const categoryApi = {
  list:   (_incl?: boolean) =>                       USE_MOCK ? mockResponse(ds.categories.list())         : api.get('/categories'),
  getById:(id: number) =>                            USE_MOCK ? mockResponse(ds.categories.get(id))        : api.get(`/categories/${id}`),
  create: (data: Record<string, unknown>) =>         USE_MOCK ? mockResponse(ds.categories.create(data))   : api.post('/categories', data),
  update: (id: number, d: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.categories.update(id, d)) : api.put(`/categories/${id}`, d),
};

// ── Billing ───────────────────────────────────────────────────────────────────
export const billingApi = {
  create: (data: Record<string, unknown>) => {
    if (USE_MOCK) {
      const payments = data.payments as Array<{ paymentMode: string; amount: number }>;
      if (payments?.some((p) => p.paymentMode === 'wallet')) {
        return Promise.reject({ response: { status: 422, data: { error: 'Wallet payment is no longer accepted.' } } });
      }
      const bill = ds.bills.create(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = bill as any;
      return mockResponse({ billId: b.id, invoiceNumber: b.invoiceNumber, grandTotal: b.grandTotal });
    }
    return api.post('/billing', data);
  },
  hold:   (data: Record<string, unknown>) => USE_MOCK ? mockResponse({ billId: 99, invoiceNumber: 'INV-HELD-00099' }) : api.post('/billing/hold', data),
  list:   (params?: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.bills.list()) : api.get('/billing', { params }),
  getById:(id: number) => USE_MOCK ? mockResponse(ds.bills.get(id)) : api.get(`/billing/${id}`),
  resume: (id: number) => USE_MOCK ? mockResponse(ds.bills.get(id)) : api.get(`/billing/${id}/resume`),
  cancel: (id: number, d: Record<string, unknown>) => USE_MOCK ? mockResponse({ message: 'Cancelled' }) : api.post(`/billing/${id}/cancel`, d),
  print:  (id: number) => USE_MOCK ? mockResponse({ printCount: 1, isDuplicate: false }) : api.post(`/billing/${id}/print`),
  getByIdFull: (id: number) => {
    if (USE_MOCK) {
      const b = ds.bills.get(id) ?? ds.bills.list()[0];
      if (!b) return mockResponse(null);
      const settings = ds.settings.get();
      return mockResponse({
        ...b,
        items: [
          { id: 1, name: 'Kaju Katli', hsnCode: '2106', quantity: 0.5, unit: 'kg', rate: 850, gstRate: 5, taxableValue: 425, cgstAmount: 10.63, sgstAmount: 10.63, totalAmount: 446.25 },
          { id: 2, name: 'Gulab Jamun', hsnCode: '2106', quantity: 4, unit: 'piece', rate: 18, gstRate: 5, taxableValue: 72, cgstAmount: 1.80, sgstAmount: 1.80, totalAmount: 75.60 },
        ],
        payments: [{ paymentMode: 'cash', amount: b.grandTotal }],
        subtotal: b.grandTotal * 0.95,
        totalCgst: b.grandTotal * 0.025,
        totalSgst: b.grandTotal * 0.025,
        totalDiscount: 0,
        roundOff: 0,
        grandTotal: b.grandTotal,
        amountInWords: 'Amount in rupees',
        cashierName: b.cashierName,
        finYear: 'FY2026-27',
        billDate: b.billDate,
        invoiceNumber: b.invoiceNumber,
        printCount: b.printCount ?? 0,
        status: b.status,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        shopName: settings.shopName,
        address:  settings.address,
        gstin:    settings.gstin,
        fssaiNumber: settings.fssaiNumber,
        invoiceFooter: settings.invoiceFooter,
        shopLogo: settings.shopLogo,
      });
    }
    return api.get(`/billing/${id}`);
  },
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const customerApi = {
  list:       (params?: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.customers.list(params)) : api.get('/customers', { params }),
  getById:    (id: number) =>                      USE_MOCK ? mockResponse(ds.customers.get(id))       : api.get(`/customers/${id}`),
  findByPhone:(phone: string) => {
    if (USE_MOCK) {
      const c = ds.customers.findByPhone(phone);
      return mockResponse(c ? { ...c, isNew: false } : { id: null, isNew: true });
    }
    return api.get('/customers/find', { params: { phone } });
  },
  history:    (id: number) => USE_MOCK ? mockResponse(ds.customers.history(id)) : api.get(`/customers/${id}/history`),
  create:     (data: Record<string, unknown>) =>         USE_MOCK ? mockResponse(ds.customers.create(data))          : api.post('/customers', data),
  update:     (id: number, d: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.customers.update(id, d))         : api.put(`/customers/${id}`, d),
};

// ── Suppliers ─────────────────────────────────────────────────────────────────
export const supplierApi = {
  list:       (incl = false) =>                          USE_MOCK ? mockResponse(ds.suppliers.list(incl))            : api.get('/suppliers'),
  getById:    (id: number) =>                            USE_MOCK ? mockResponse(ds.suppliers.get(id))               : api.get(`/suppliers/${id}`),
  getBalance: (id: number) =>                            USE_MOCK ? mockResponse(ds.suppliers.getBalance(id))        : api.get(`/suppliers/${id}/balance`),
  getHistory: (id: number) =>                            USE_MOCK ? mockResponse(ds.suppliers.getHistory(id))        : api.get(`/suppliers/${id}/history`),
  create:     (data: Record<string, unknown>) =>         USE_MOCK ? mockResponse(ds.suppliers.create(data))          : api.post('/suppliers', data),
  update:     (id: number, d: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.suppliers.update(id, d))         : api.put(`/suppliers/${id}`, d),
};

// ── Raw Materials ─────────────────────────────────────────────────────────────
export const rawMaterialApi = {
  list:       (incl = false) =>                          USE_MOCK ? mockResponse(ds.rawMaterials.list(incl))         : api.get('/raw-materials'),
  getById:    (id: number) =>                            USE_MOCK ? mockResponse(ds.rawMaterials.get(id))            : api.get(`/raw-materials/${id}`),
  lowStock:   () =>                                      USE_MOCK ? mockResponse(ds.rawMaterials.lowStock())         : api.get('/raw-materials/low-stock'),
  nearExpiry: (days?: number) =>                         USE_MOCK ? mockResponse(ds.rawMaterials.nearExpiry(days))   : api.get('/raw-materials/near-expiry'),
  create:     (data: Record<string, unknown>) =>         USE_MOCK ? mockResponse(ds.rawMaterials.create(data))       : api.post('/raw-materials', data),
  update:     (id: number, d: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.rawMaterials.update(id, d))      : api.put(`/raw-materials/${id}`, d),
  setConversion:(id: number, d: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.rawMaterials.setConversion(id, d)) : api.post(`/raw-materials/${id}/conversions`, d),
};

// ── Purchases ─────────────────────────────────────────────────────────────────
export const purchaseApi = {
  listReceipts:  (_p?: Record<string, unknown>) =>      USE_MOCK ? mockResponse(ds.purchaseReceipts.list())           : api.get('/purchases/receipts'),
  getReceipt:    (id: number) =>                         USE_MOCK ? mockResponse(ds.purchaseReceipts.get(id))          : api.get(`/purchases/receipts/${id}`),
  createReceipt: (data: Record<string, unknown>) =>      USE_MOCK ? mockResponse(ds.purchaseReceipts.create(data))     : api.post('/purchases/receipts', data),
  createPayment: (data: Record<string, unknown>) => {
    if (USE_MOCK) {
      const { receiptId, amountPaid, paymentMode } = data as { receiptId: number; amountPaid: number; paymentMode: string };
      return mockResponse(ds.purchaseReceipts.recordPayment(receiptId, amountPaid, paymentMode));
    }
    return api.post('/purchases/payments', data);
  },
  createPO: (data: Record<string, unknown>) => USE_MOCK ? mockResponse({}) : api.post('/purchases/po', data),
};

// ── Recipes ───────────────────────────────────────────────────────────────────
export const recipeApi = {
  list:    (_id?: number) => USE_MOCK ? mockResponse([]) : api.get('/recipes'),
  getById: (id: number)   => USE_MOCK ? mockResponse(null) : api.get(`/recipes/${id}`),
  create:  (data: Record<string, unknown>) => USE_MOCK ? mockResponse({}) : api.post('/recipes', data),
};

// ── Production ────────────────────────────────────────────────────────────────
export const productionApi = {
  list:        (params?: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.batches.list(params))  : api.get('/production'),
  getById:     (id: number) =>                       USE_MOCK ? mockResponse(ds.batches.get(id))       : api.get(`/production/${id}`),
  create:      (data: Record<string, unknown>) =>    USE_MOCK ? mockResponse(ds.batches.create(data))  : api.post('/production', data),
  complete:    (id: number, data: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.batches.complete(id, data)) : api.post(`/production/${id}/complete`, data),
  traceability:(id: number) => USE_MOCK ? mockResponse({}) : api.get(`/production/${id}/traceability`),
};

// ── Stock ─────────────────────────────────────────────────────────────────────
export const stockApi = {
  finished:    (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.stock.list()) : api.get('/stock/finished'),
  expired:     () => USE_MOCK ? mockResponse(ds.stock.expired())                          : api.get('/stock/expired'),
  movements:   (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse([])              : api.get('/stock/movements'),
  listWastage: (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.stock.wastage()) : api.get('/stock/wastage'),
  wastage:     (data: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.stock.recordWastage(data)) : api.post('/stock/wastage', data),
  adjust:      (data: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.stock.adjust(data))        : api.post('/stock/adjust', data),
  moveToCounter: (data: Record<string, unknown>) => {
    if (USE_MOCK) {
      const result = ds.stock.moveToCounter(Number(data.productId), data.batchId ? Number(data.batchId) : null, Number(data.quantity));
      return result.error ? Promise.reject({ response: { data: { error: result.error } } }) : mockResponse({ ok: true });
    }
    return api.post('/stock/move-to-counter', data);
  },
  returnToStore: (data: Record<string, unknown>) => {
    if (USE_MOCK) {
      const result = ds.stock.returnToStore(Number(data.productId), data.batchId ? Number(data.batchId) : null, Number(data.quantity));
      return result.error ? Promise.reject({ response: { data: { error: result.error } } }) : mockResponse({ ok: true });
    }
    return api.post('/stock/return-to-store', data);
  },
  /** Get counter stock for one product — used by Billing */
  counterQty: (productId: number): number => {
    if (USE_MOCK) return ds.stock.counterQty(productId);
    return 0;  // in real mode, call stockApi.finished() and sum
  },
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const orderApi = {
  list:            (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.orders.list())           : api.get('/orders'),
  getById:         (id: number) =>                   USE_MOCK ? mockResponse(ds.orders.get(id))          : api.get(`/orders/${id}`),
  create:          (data: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.orders.create(data))    : api.post('/orders', data),
  updateStatus:    (id: number, data: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.orders.update(id, data)) : api.put(`/orders/${id}/status`, data),
  delete:          (id: number) => USE_MOCK ? mockResponse(ds.orders.delete(id)) : api.delete(`/orders/${id}`),
  productionSheet: (_date?: string) => USE_MOCK ? mockResponse(ds.orders.productionSheet()) : api.get('/orders/production-sheet'),
};

// ── Shifts ────────────────────────────────────────────────────────────────────
export const shiftApi = {
  list:    () => USE_MOCK ? mockResponse(ds.shifts.list()) : api.get('/shifts'),
  open:    (openingFloat: number) => {
    if (USE_MOCK) {
      const shift = ds.shifts.open(3, openingFloat);  // default cashier_id=3
      return mockResponse({ shiftId: shift.id });
    }
    return api.post('/shifts/open', { openingFloat });
  },
  close:   (id: number, countedCash: number, notes?: string, countedByName?: string) => {
    if (USE_MOCK) {
      const shift = ds.shifts.close(id, countedCash, notes, countedByName);
      return mockResponse(shift);
    }
    return api.post(`/shifts/${id}/close`, { countedCash, notes, countedByName });
  },
  addCashEntry: (id: number, data: Record<string, unknown>) =>
    USE_MOCK ? mockResponse({}) : api.post(`/shifts/${id}/cash-entries`, data),
  dayEnd: (id: number) =>
    USE_MOCK ? mockResponse(ds.shifts.dayEnd(id)) : api.get(`/shifts/${id}/day-end`),
};

// ── Expenses ──────────────────────────────────────────────────────────────────
export const expenseApi = {
  list:    (_p?: Record<string, unknown>) =>             USE_MOCK ? mockResponse(ds.expenses.list())          : api.get('/expenses'),
  summary: (_p?: Record<string, unknown>) =>             USE_MOCK ? mockResponse(ds.expenses.summary())       : api.get('/expenses/summary'),
  create:  (data: Record<string, unknown>) =>            USE_MOCK ? mockResponse(ds.expenses.create(data))    : api.post('/expenses', data),
  update:  (id: number, d: Record<string, unknown>) =>   USE_MOCK ? mockResponse(ds.expenses.update(id, d))   : api.put(`/expenses/${id}`, d),
  delete:  (id: number) =>                               USE_MOCK ? mockResponse(ds.expenses.delete(id))      : api.delete(`/expenses/${id}`),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportApi = {
  salesSummary:      (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.reports.salesSummary())       : api.get('/reports/sales/summary'),
  salesByProduct:    (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse([])                              : api.get('/reports/sales/by-product'),
  salesByPaymentMode:(_p?: Record<string, unknown>) => USE_MOCK ? mockResponse([{ payment_mode: 'cash', total: ds.reports.salesSummary().totalRevenue, count: ds.reports.salesSummary().billCount }]) : api.get('/reports/sales/by-payment-mode'),
  salesByCashier:    (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse([])                              : api.get('/reports/sales/by-cashier'),
  salesByHour:       (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse([])                              : api.get('/reports/sales/by-hour'),
  stockValuation:    () =>                             USE_MOCK ? mockResponse([])                              : api.get('/reports/stock-valuation'),
  gst:               (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse({ outputTax: [], inputTax: [] }) : api.get('/reports/gst'),
  wastage:           (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse([])                              : api.get('/reports/wastage'),
  production:        (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.batches.list().filter((b) => b.produced_quantity != null)) : api.get('/reports/production'),
  profit:            (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse({ totalRevenue: 5025, totalCogs: 2100, grossProfit: 2925, totalExpenses: 37300, netProfit: -34375, grossMargin: 58.2, netMargin: -683.9 }) : api.get('/reports/profit'),
  shiftsSummary: () => {
    if (USE_MOCK) {
      const shifts = ds.shifts.list();
      return mockResponse(shifts.map((s) => ({
        id:             s.id,
        cashier_name:   s.cashier_name ?? s.cashierName ?? 'Unknown',
        counted_by_name:s.counted_by_name ?? null,
        opened_at:      s.opened_at ?? s.openedAt ?? null,
        closed_at:      s.closed_at ?? s.closedAt ?? null,
        status:         s.status,
        opening_float:  s.opening_float ?? 0,
        expected_cash:  (s.opening_float ?? 0) + (s.expected_cash ?? 0),
        counted_cash:   s.counted_cash ?? null,
        shortage:       s.shortage ?? null,
      })));
    }
    return api.get('/reports/shifts-summary');
  },
};

// ── Settings ──────────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () => USE_MOCK ? mockResponse(ds.settings.get()) : api.get('/settings'),
  update: (data: Record<string, unknown>) => {
    if (USE_MOCK) return mockResponse(ds.settings.update(data as Parameters<typeof ds.settings.update>[0]));
    return api.put('/settings', data);
  },
  auditLog: (_p?: Record<string, unknown>) => USE_MOCK ? mockResponse([]) : api.get('/settings/audit-log'),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const userApi = {
  list:          (incl = false) =>                       USE_MOCK ? mockResponse(ds.users.list(incl))               : api.get('/users', { params: { includeInactive: incl } }),
  getById:       (id: number) =>                         USE_MOCK ? mockResponse(ds.users.get(id))                  : api.get(`/users/${id}`),
  create:        (data: Record<string, unknown>) =>      USE_MOCK ? mockResponse(ds.users.create(data))             : api.post('/users', data),
  update:        (id: number, d: Record<string, unknown>) => USE_MOCK ? mockResponse(ds.users.update(id, d))        : api.put(`/users/${id}`, d),
  resetPassword: (id: number, newPassword: string | null) => USE_MOCK ? mockResponse({ generatedPassword: newPassword ?? 'Temp@1234!' }) : api.post(`/users/${id}/reset-password`, { newPassword }),
  deactivate:    (id: number, reason: string) =>         USE_MOCK ? mockResponse(ds.users.deactivate(id, reason))   : api.post(`/users/${id}/deactivate`, { reason }),
  activate:      (id: number) =>                         USE_MOCK ? mockResponse(ds.users.activate(id))             : api.post(`/users/${id}/activate`, {}),
  unlock:        (id: number) =>                         USE_MOCK ? mockResponse(ds.users.unlock(id))               : api.post(`/users/${id}/unlock`, {}),
  getPermissions:(id: number) =>                         USE_MOCK ? mockResponse(ds.users.getPermissions(id))       : api.get(`/users/${id}/permissions`),
  setPermissions:(id: number, perms: Record<string, boolean>) =>
    USE_MOCK ? mockResponse(ds.users.setPermissions(id, perms)) : api.put(`/users/${id}/permissions`, { permissions: perms }),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationApi = {
  alerts: () => USE_MOCK ? mockResponse(ds.notifications.alerts()) : api.get('/notifications/alerts'),
};

// ── Demo-only helpers ─────────────────────────────────────────────────────────
export const demoApi = {
  reset: () => {
    ds.resetDemoData();
    return mockResponse({ ok: true });
  },
  subscribe: ds.subscribe,
  /** Live counter qty for a product — used by Billing */
  counterQty: (productId: number) => ds.stock.counterQty(productId),
};
