import api, { mockResponse, IS_MOCK } from './client';
import * as mock from './mock';

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) => {
    if (IS_MOCK) {
      // Accept any username/password in mock mode
      return mockResponse({
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        user: { ...mock.mockUser, username, displayName: username === 'admin' ? 'Shop Owner' : username },
      });
    }
    return api.post('/auth/login', { username, password });
  },
  pinLogin: (pin: string) => {
    if (IS_MOCK) {
      return mockResponse({ accessToken: 'mock-token', refreshToken: 'mock-refresh', user: mock.mockUser });
    }
    return api.post('/auth/pin-login', { pin });
  },
  me: () => {
    if (IS_MOCK) return mockResponse({ user: mock.mockUser });
    return api.get('/auth/me');
  },
  logout: () => {
    if (IS_MOCK) return mockResponse({ message: 'ok' });
    return api.post('/auth/logout');
  },
};

// ── Products ──────────────────────────────────────────
export const productApi = {
  list: (params?: Record<string, unknown>) => {
    if (IS_MOCK) {
      let data = mock.mockProducts;
      if (params?.categoryId) data = data.filter((p) => p.categoryId === params.categoryId);
      if (params?.search) {
        const q = String(params.search).toLowerCase();
        data = data.filter((p) =>
          p.name.toLowerCase().includes(q) ||
          p.productCode?.toLowerCase().startsWith(q)
        );
      }
      return mockResponse(data);
    }
    return api.get('/products', { params });
  },
  getById: (id: number) => {
    if (IS_MOCK) return mockResponse(mock.mockProducts.find((p) => p.id === id));
    return api.get(`/products/${id}`);
  },
  /** Look up a product by its short code — used for billing Enter-to-add. */
  getByCode: (code: string) => {
    if (IS_MOCK) {
      const p = mock.mockProducts.find(
        (p) => p.productCode?.toLowerCase() === code.toLowerCase()
      );
      if (p) return mockResponse(p);
      return Promise.reject({ response: { status: 404, data: { error: `No product found for code "${code}"` } } });
    }
    return api.get(`/products/by-code/${encodeURIComponent(code)}`);
  },
  create: (data: Record<string, unknown>) => api.post('/products', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/products/${id}`, data),
  getVariants: (id: number) => {
    if (IS_MOCK) return mockResponse([]);
    return api.get(`/products/${id}/variants`);
  },
  createVariant: (id: number, data: Record<string, unknown>) => api.post(`/products/${id}/variants`, data),
  getPriceHistory: (id: number) => {
    if (IS_MOCK) return mockResponse([]);
    return api.get(`/products/${id}/price-history`);
  },
};

// ── Categories ────────────────────────────────────────
export const categoryApi = {
  list: (_includeInactive?: boolean) => {
    if (IS_MOCK) return mockResponse(mock.mockCategories);
    return api.get('/categories');
  },
  getById: (id: number) => {
    if (IS_MOCK) return mockResponse(mock.mockCategories.find((c) => c.id === id));
    return api.get(`/categories/${id}`);
  },
  create: (data: Record<string, unknown>) => api.post('/categories', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/categories/${id}`, data),
};

// ── Billing ───────────────────────────────────────────
export const billingApi = {
  create: (data: Record<string, unknown>) => {
    if (IS_MOCK) {
      const id = mock.mockBills.length + 1;
      const invoiceNumber = `INV-FY2026-27-${String(id).padStart(5, '0')}`;
      const payments = data.payments as Array<{ paymentMode: string; amount: number }>;
      if (payments?.some((p) => p.paymentMode === 'wallet')) {
        return Promise.reject({ response: { status: 422, data: { error: 'Wallet payment is no longer accepted. Use Cash, UPI, or Card.' } } });
      }
      const items = data.items as Array<{ quantity: number; rate: number; gstRate: number }>;
      const grandTotal = items.reduce((s, i) => s + i.quantity * i.rate * (1 + i.gstRate / 100), 0);
      return mockResponse({ billId: id, invoiceNumber, grandTotal: Math.round(grandTotal) });
    }
    return api.post('/billing', data);
  },
  hold: (data: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse({ billId: 99, invoiceNumber: 'INV-HELD-00099' });
    return api.post('/billing/hold', data);
  },
  list: (params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse(mock.mockBills);
    return api.get('/billing', { params });
  },
  getById: (id: number) => {
    if (IS_MOCK) return mockResponse(mock.mockBills.find((b) => b.id === id));
    return api.get(`/billing/${id}`);
  },
  resume: (id: number) => {
    if (IS_MOCK) return mockResponse(mock.mockBills.find((b) => b.id === id));
    return api.get(`/billing/${id}/resume`);
  },
  cancel: (id: number, data: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse({ message: 'Cancelled' });
    return api.post(`/billing/${id}/cancel`, data);
  },
  print: (id: number) => {
    if (IS_MOCK) return mockResponse({ printCount: 1, isDuplicate: false });
    return api.post(`/billing/${id}/print`);
  },
  /** Full bill data for the print route — includes items, payments, customer */
  getByIdFull: (id: number) => {
    if (IS_MOCK) {
      const b = mock.mockBills.find((b) => b.id === id) ?? mock.mockBills[0];
      return mockResponse({
        ...b,
        items: [
          { id: 1, name: 'Kaju Katli', hsnCode: '2106', quantity: 0.5, unit: 'kg', rate: 850, gstRate: 5, taxableValue: 425, cgstAmount: 10.63, sgstAmount: 10.63, totalAmount: 446.25 },
          { id: 2, name: 'Gulab Jamun', hsnCode: '2106', quantity: 4, unit: 'piece', rate: 18, gstRate: 5, taxableValue: 72, cgstAmount: 1.80, sgstAmount: 1.80, totalAmount: 75.60 },
          { id: 3, name: 'Ferrero Rocher (16pc)', hsnCode: '1806', quantity: 1, unit: 'box', rate: 420, gstRate: 18, taxableValue: 420, cgstAmount: 37.80, sgstAmount: 37.80, totalAmount: 495.60 },
        ],
        payments: [{ paymentMode: b.status === 'paid' ? 'cash' : 'upi', amount: b.grandTotal }],
        subtotal: 917,
        totalCgst: 50.23,
        totalSgst: 50.23,
        totalDiscount: 0,
        roundOff: 0,
        grandTotal: b.grandTotal,
        amountInWords: 'One thousand seventeen rupees only',
        cashierName: b.cashierName,
        finYear: 'FY2026-27',
        billDate: b.billDate,
        invoiceNumber: b.invoiceNumber,
        printCount: b.printCount,
        status: b.status,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
      });
    }
    return api.get(`/billing/${id}`);
  },
};

// ── Customers ─────────────────────────────────────────
export const customerApi = {
  list: (params?: Record<string, unknown>) => {
    if (IS_MOCK) {
      let data = mock.mockCustomers;
      if (params?.search) data = data.filter((c) => c.name.toLowerCase().includes(String(params.search).toLowerCase()) || c.phone.includes(String(params.search)));
      return mockResponse(data);
    }
    return api.get('/customers', { params });
  },
  getById: (id: number) => {
    if (IS_MOCK) return mockResponse(mock.mockCustomers.find((c) => c.id === id));
    return api.get(`/customers/${id}`);
  },
  findByPhone: (phone: string) => {
    if (IS_MOCK) {
      const c = mock.mockCustomers.find((c) => c.phone === phone);
      return mockResponse(c ? { ...c, isNew: false } : { id: 99, isNew: true });
    }
    return api.get('/customers/find', { params: { phone } });
  },
  history: (id: number) => {
    if (IS_MOCK) return mockResponse({ bills: mock.mockBills.slice(0, 3), loyalty: [], favourites: [] });
    return api.get(`/customers/${id}/history`);
  },
  create: (data: Record<string, unknown>) => api.post('/customers', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/customers/${id}`, data),
};

// ── Suppliers ─────────────────────────────────────────
export const supplierApi = {
  list: (_includeInactive?: boolean) => {
    if (IS_MOCK) return mockResponse(mock.mockSuppliers);
    return api.get('/suppliers');
  },
  getById: (id: number) => {
    if (IS_MOCK) return mockResponse(mock.mockSuppliers.find((s) => s.id === id));
    return api.get(`/suppliers/${id}`);
  },
  getBalance: (id: number) => {
    if (IS_MOCK) return mockResponse({ totalPurchases: 8400, totalReturns: 0, totalPayments: 4200, outstanding: 4200 });
    return api.get(`/suppliers/${id}/balance`);
  },
  getHistory: (id: number) => {
    if (IS_MOCK) return mockResponse({ receipts: mock.mockPurchaseReceipts.filter((r) => r.supplier_id === id), payments: [] });
    return api.get(`/suppliers/${id}/history`);
  },
  create: (data: Record<string, unknown>) => api.post('/suppliers', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/suppliers/${id}`, data),
};

// ── Raw Materials ─────────────────────────────────────
export const rawMaterialApi = {
  list: (_includeInactive?: boolean) => {
    if (IS_MOCK) return mockResponse(mock.mockRawMaterials);
    return api.get('/raw-materials');
  },
  getById: (id: number) => {
    if (IS_MOCK) return mockResponse(mock.mockRawMaterials.find((m) => m.id === id));
    return api.get(`/raw-materials/${id}`);
  },
  lowStock: () => {
    if (IS_MOCK) return mockResponse(mock.mockRawMaterials.filter((m) => m.currentStock < m.minStockLevel));
    return api.get('/raw-materials/low-stock');
  },
  nearExpiry: (_days?: number) => {
    if (IS_MOCK) return mockResponse(mock.mockRawMaterials.filter((m) => m.earliestExpiry));
    return api.get('/raw-materials/near-expiry');
  },
  create: (data: Record<string, unknown>) => api.post('/raw-materials', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/raw-materials/${id}`, data),
  setConversion: (id: number, data: Record<string, unknown>) => api.post(`/raw-materials/${id}/conversions`, data),
};

// ── Purchases ──────────────────────────────────────────
export const purchaseApi = {
  listReceipts: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse(mock.mockPurchaseReceipts);
    return api.get('/purchases/receipts');
  },
  getReceipt: (id: number) => {
    if (IS_MOCK) return mockResponse(mock.mockPurchaseReceipts.find((r) => r.id === id));
    return api.get(`/purchases/receipts/${id}`);
  },
  createReceipt: (data: Record<string, unknown>) => api.post('/purchases/receipts', data),
  createPayment: (data: Record<string, unknown>) => api.post('/purchases/payments', data),
  createPO: (data: Record<string, unknown>) => api.post('/purchases/po', data),
};

// ── Recipes ────────────────────────────────────────────
export const recipeApi = {
  list: (_productId?: number) => {
    if (IS_MOCK) return mockResponse([]);
    return api.get('/recipes');
  },
  getById: (id: number) => api.get(`/recipes/${id}`),
  create: (data: Record<string, unknown>) => api.post('/recipes', data),
};

// ── Production ─────────────────────────────────────────
export const productionApi = {
  list: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse(mock.mockBatches);
    return api.get('/production');
  },
  getById: (id: number) => {
    if (IS_MOCK) return mockResponse(mock.mockBatches.find((b) => b.id === id));
    return api.get(`/production/${id}`);
  },
  create: (data: Record<string, unknown>) => api.post('/production', data),
  complete: (id: number, data: Record<string, unknown>) => api.post(`/production/${id}/complete`, data),
  traceability: (id: number) => api.get(`/production/${id}/traceability`),
};

// ── Stock ──────────────────────────────────────────────
export const stockApi = {
  finished: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse(mock.mockStock);
    return api.get('/stock/finished');
  },
  expired: () => {
    if (IS_MOCK) return mockResponse([]);
    return api.get('/stock/expired');
  },
  movements: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse([]);
    return api.get('/stock/movements');
  },
  wastage: (data: Record<string, unknown>) => api.post('/stock/wastage', data),
  listWastage: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse([]);
    return api.get('/stock/wastage');
  },
  adjust: (data: Record<string, unknown>) => api.post('/stock/adjust', data),
};

// ── Orders ────────────────────────────────────────────
export const orderApi = {
  list: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse(mock.mockOrders);
    return api.get('/orders');
  },
  getById: (id: number) => {
    if (IS_MOCK) return mockResponse(mock.mockOrders.find((o) => o.id === id));
    return api.get(`/orders/${id}`);
  },
  create: (data: Record<string, unknown>) => api.post('/orders', data),
  updateStatus: (id: number, data: Record<string, unknown>) => api.put(`/orders/${id}/status`, data),
  productionSheet: (_date?: string) => {
    if (IS_MOCK) return mockResponse(mock.mockOrders.filter((o) => ['booked', 'in_production', 'ready'].includes(o.status)));
    return api.get('/orders/production-sheet');
  },
};

// ── Shifts ────────────────────────────────────────────
export const shiftApi = {
  open: (openingFloat: number) => {
    if (IS_MOCK) return mockResponse({ shiftId: 5 });
    return api.post('/shifts/open', { openingFloat });
  },
  close: (id: number, countedCash: number, notes?: string) => {
    if (IS_MOCK) return mockResponse({ shiftId: id, openingFloat: 1000, cashSales: 5025, cashReturns: 0, cashIn: 0, cashOut: 200, expectedCash: 5825, countedCash, shortage: countedCash - 5825 });
    return api.post(`/shifts/${id}/close`, { countedCash, notes });
  },
  addCashEntry: (id: number, data: Record<string, unknown>) => api.post(`/shifts/${id}/cash-entries`, data),
  dayEnd: (id: number) => {
    if (IS_MOCK) return mockResponse({ shiftId: id, openingFloat: 1000, expectedCash: 5825, countedCash: 5800, shortage: -25, salesByMode: [{ payment_mode: 'cash', bill_count: 2, total: 2635 }, { payment_mode: 'upi', bill_count: 2, total: 2390 }], totalDiscounts: 150 });
    return api.get(`/shifts/${id}/day-end`);
  },
};

// ── Expenses ───────────────────────────────────────────
export const expenseApi = {
  list: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse(mock.mockExpenses);
    return api.get('/expenses');
  },
  summary: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse([{ category: 'rent', total: 25000 }, { category: 'electricity', total: 4800 }, { category: 'packaging', total: 3200 }, { category: 'gas', total: 1800 }, { category: 'repairs', total: 2500 }]);
    return api.get('/expenses/summary');
  },
  create: (data: Record<string, unknown>) => api.post('/expenses', data),
};

// ── Reports ────────────────────────────────────────────
export const reportApi = {
  salesSummary: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse(mock.mockSalesSummary);
    return api.get('/reports/sales/summary');
  },
  salesByProduct: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse([
      { item_name: 'Kaju Katli', product_name: 'Kaju Katli', total_qty: 12.5, totalAmount: 10625, totalCost: 5000, totalProfit: 5625, times_sold: 8 },
      { item_name: 'Gulab Jamun', product_name: 'Gulab Jamun', total_qty: 85, totalAmount: 1530, totalCost: 680, totalProfit: 850, times_sold: 12 },
      { item_name: 'Chocolate Truffle Cake (1kg)', product_name: 'Chocolate Truffle Cake (1kg)', total_qty: 3, totalAmount: 2700, totalCost: 1140, totalProfit: 1560, times_sold: 3 },
    ]);
    return api.get('/reports/sales/by-product');
  },
  salesByPaymentMode: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse([{ payment_mode: 'cash', total: 2635, count: 2 }, { payment_mode: 'upi', total: 2390, count: 2 }]);
    return api.get('/reports/sales/by-payment-mode');
  },
  salesByCashier: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse([{ cashier_id: 3, cashier_name: 'Amit Cashier', bill_count: 2, total_sales: 2135, total_discounts: 100 }, { cashier_id: 4, cashier_name: 'Priya Cashier', bill_count: 2, total_sales: 2890, total_discounts: 50 }]);
    return api.get('/reports/sales/by-cashier');
  },
  salesByHour: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse([{ hour: 10, bill_count: 1, total_sales: 1739 }, { hour: 11, bill_count: 1, total_sales: 396 }, { hour: 12, bill_count: 1, total_sales: 2890 }, { hour: 14, bill_count: 1, total_sales: 0 }]);
    return api.get('/reports/sales/by-hour');
  },
  stockValuation: () => {
    if (IS_MOCK) return mockResponse([
      { id: 1, name: 'Kaju Katli', totalQty: 7.2, costPrice: 400, sellingPrice: 850, stockValueCost: 2880, stockValueRetail: 6120 },
      { id: 9, name: 'Rasgulla (1kg)', totalQty: 12, costPrice: 120, sellingPrice: 280, stockValueCost: 1440, stockValueRetail: 3360 },
    ]);
    return api.get('/reports/stock-valuation');
  },
  gst: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse({
      outputTax: [{ gstRate: 5, taxableValue: 2800, cgst: 70, sgst: 70, totalTax: 140 }, { gstRate: 18, taxableValue: 1500, cgst: 135, sgst: 135, totalTax: 270 }],
      inputTax: [{ gstRate: 5, taxableValue: 4500, inputTax: 225 }, { gstRate: 18, taxableValue: 8400, inputTax: 1512 }],
    });
    return api.get('/reports/gst');
  },
  wastage: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse([]);
    return api.get('/reports/wastage');
  },
  production: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse(mock.mockBatches.filter((b) => b.status === 'completed'));
    return api.get('/reports/production');
  },
  profit: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse({ totalRevenue: 5025, totalCogs: 2100, grossProfit: 2925, totalExpenses: 37300, netProfit: -34375, grossMargin: 58.2, netMargin: -683.9 });
    return api.get('/reports/profit');
  },
};

// ── Settings ───────────────────────────────────────────
export const settingsApi = {
  get: () => {
    if (IS_MOCK) return mockResponse({ id: 1, shopName: 'Sweet Dreams Bakery', logoUrl: null, address: '42, MG Road, Pune – 411001', phone: '020-12345678', email: 'hello@sweetdreams.in', gstin: '27AABCU9603R1ZM', fssaiNumber: '10019032001234', invoicePrefix: 'SDR', invoiceFooter: 'Thank you for visiting! Return policy: exchanges within 1 hour.', taxInclusive: false, currency: 'INR', receiptPaper: '80mm', stockBlockZero: false, loyaltyEnabled: true, loyaltyPointsPerRupee: 0.5, loyaltyMinRedeem: 100 });
    return api.get('/settings');
  },
  update: (data: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse(data);
    return api.put('/settings', data);
  },
  auditLog: (_params?: Record<string, unknown>) => {
    if (IS_MOCK) return mockResponse([]);
    return api.get('/settings/audit-log');
  },
};

// ── Users ──────────────────────────────────────────────
export const userApi = {
  list: (_includeInactive?: boolean) => {
    if (IS_MOCK) return mockResponse(mock.mockUsers);
    return api.get('/users');
  },
  getById: (id: number) => {
    if (IS_MOCK) return mockResponse(mock.mockUsers.find((u) => u.id === id));
    return api.get(`/users/${id}`);
  },
  create: (data: Record<string, unknown>) => api.post('/users', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
  resetPassword: (id: number, newPassword: string) => api.post(`/users/${id}/reset-password`, { newPassword }),
  deactivate: (id: number, reason: string) => api.post(`/users/${id}/deactivate`, { reason }),
};

// ── Notifications ───────────────────────────────────────
export const notificationApi = {
  alerts: () => {
    if (IS_MOCK) return mockResponse(mock.mockAlerts);
    return api.get('/notifications/alerts');
  },
};
