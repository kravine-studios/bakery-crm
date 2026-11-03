// @ts-nocheck
/**
 * demoStore — localStorage-backed demo data store.
 * @ts-nocheck — this store uses dynamic any[] operations; types are guaranteed correct at runtime.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment

import { seedDemoData } from './demoSeed';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  products:       'demo_products',
  categories:     'demo_categories',
  customers:      'demo_customers',
  suppliers:      'demo_suppliers',
  rawMaterials:   'demo_raw_materials',
  batches:        'demo_batches',
  bills:          'demo_bills',
  orders:         'demo_orders',
  expenses:       'demo_expenses',
  users:          'demo_users',
  purchaseReceipts:'demo_purchase_receipts',
  stock:          'demo_stock',
  alerts:         'demo_alerts',
  salesSummary:   'demo_sales_summary',
  shifts:         'demo_shifts',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage quota exceeded — ignore
  }
}

function nextId(arr: { id: number }[]): number {
  return arr.length > 0 ? Math.max(...arr.map((x) => x.id)) + 1 : 1;
}

// ─── Initialise ───────────────────────────────────────────────────────────────

function init() {
  const seed = seedDemoData();
  return {
    products:       load(KEYS.products)        ?? seed.products,
    categories:     load(KEYS.categories)      ?? seed.categories,
    customers:      load(KEYS.customers)       ?? seed.customers,
    suppliers:      load(KEYS.suppliers)       ?? seed.suppliers,
    rawMaterials:   load(KEYS.rawMaterials)    ?? seed.rawMaterials,
    batches:        load(KEYS.batches)         ?? seed.batches,
    bills:          load(KEYS.bills)           ?? seed.bills,
    orders:         load(KEYS.orders)          ?? seed.orders,
    expenses:       load(KEYS.expenses)        ?? seed.expenses,
    users:          load(KEYS.users)           ?? seed.users,
    purchaseReceipts: load(KEYS.purchaseReceipts) ?? seed.purchaseReceipts,
    stock:          load(KEYS.stock)           ?? seed.stock,
    shifts:         load(KEYS.shifts)          ?? seed.shifts,
  };
}

// ─── State ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let state: Record<string, any> = init();

// Subscribers notified on every mutation (used for live stock updates)
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }
function notify() { listeners.forEach((fn) => fn()); }

// ─── Generic CRUD helpers ─────────────────────────────────────────────────────

function getAll(key: string) { return [...state[key]]; }

function getById(key: string, id: number) {
  return state[key].find((x: { id: number }) => x.id === id) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function create(key: string, data: Record<string, any>) {
  const item = { ...data, id: nextId(state[key]) };
  state[key] = [...state[key], item];
  save(key, state[key]);
  notify();
  return item;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function update(key: string, id: number, data: Partial<Record<string, any>>) {
  state[key] = state[key].map((x: { id: number }) => x.id === id ? { ...x, ...data } : x);
  save(key, state[key]);
  notify();
  return state[key].find((x: { id: number }) => x.id === id) ?? null;
}

function remove(key: string, id: number) {
  state[key] = state[key].filter((x: { id: number }) => x.id !== id);
  save(key, state[key]);
  notify();
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export function resetDemoData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  const seed = seedDemoData();
  state = seed as unknown as Record<string, unknown[]>;
  Object.entries(KEYS).forEach(([dataKey, storageKey]) => {
    save(storageKey, (state as Record<string, unknown>)[dataKey]);
  });
  notify();
}

// ─── Products ─────────────────────────────────────────────────────────────────

export const products = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list(params?: Record<string, any>) {
    let data = getAll('products');
    if (params?.categoryId) data = data.filter((p) => p.categoryId === params.categoryId);
    if (params?.search) {
      const q = String(params.search).toLowerCase();
      data = data.filter((p) =>
        p.name.toLowerCase().includes(q) || p.productCode?.toLowerCase().startsWith(q)
      );
    }
    if (params?.active !== undefined) data = data.filter((p) => p.isActive === (params.active === true || params.active === 'true'));
    return data;
  },
  get: (id: number) => getById('products', id),
  getByCode: (code: string) => state['products'].find((p) => p.productCode?.toLowerCase() === code.toLowerCase()) ?? null,
  create: (data: Record<string, unknown>) => {
    // Auto-assign product code
    const existing = getAll('products');
    const maxCode = existing.reduce((max, p) => {
      const n = parseInt(p.productCode ?? '0', 10);
      return n > max ? n : max;
    }, 0);
    const productCode = String(maxCode + 1).padStart(3, '0');
    return create('products', { ...data, productCode, isActive: true, created_at: new Date().toISOString() });
  },
  update: (id: number, data: Record<string, unknown>) => update('products', id, data),
  delete: (id: number) => update('products', id, { isActive: false }),
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const categories = {
  list: () => getAll('categories').filter((c) => c.isActive !== false),
  get: (id: number) => getById('categories', id),
  create: (data: Record<string, unknown>) => create('categories', { ...data, isActive: true }),
  update: (id: number, data: Record<string, unknown>) => update('categories', id, data),
};

// ─── Customers ────────────────────────────────────────────────────────────────

export const customers = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list(params?: Record<string, any>) {
    let data = getAll('customers').filter((c) => c.isActive !== false);
    if (params?.search) {
      const q = String(params.search).toLowerCase();
      data = data.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return data;
  },
  get: (id: number) => getById('customers', id),
  findByPhone: (phone: string) => state['customers'].find((c) => c.phone === phone) ?? null,
  create: (data: Record<string, unknown>) => create('customers', { ...data, isActive: true, loyaltyPoints: 0, creditBalance: 0 }),
  update: (id: number, data: Record<string, unknown>) => update('customers', id, data),
  history: (id: number) => ({
    bills: state['bills'].filter((b) => b.customer_id === id || b.customerId === id).slice(0, 5),
    loyalty: [],
    favourites: [],
  }),
};

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const suppliers = {
  list: (includeInactive = false) => {
    const data = getAll('suppliers');
    return includeInactive ? data : data.filter((s) => s.isActive !== false);
  },
  get: (id: number) => getById('suppliers', id),
  create: (data: Record<string, unknown>) => create('suppliers', { ...data, isActive: true }),
  update: (id: number, data: Record<string, unknown>) => update('suppliers', id, data),
  getBalance: (id: number) => {
    const receipts = state['purchaseReceipts'].filter((r) => r.supplier_id === id);
    const totalPurchases = receipts.reduce((s, r) => s + (r.grandTotal ?? r.grand_total ?? 0), 0);
    const totalPaid      = receipts.reduce((s, r) => s + (r.amount_paid ?? 0), 0);
    return { totalPurchases, totalPaid, outstanding: totalPurchases - totalPaid };
  },
  getHistory: (id: number) => ({
    receipts: state['purchaseReceipts'].filter((r) => r.supplier_id === id),
    payments: [],
  }),
};

// ─── Raw Materials ────────────────────────────────────────────────────────────

export const rawMaterials = {
  list: (includeInactive = false) => {
    const data = getAll('rawMaterials');
    return includeInactive ? data : data.filter((m) => m.isActive !== false);
  },
  get: (id: number) => getById('rawMaterials', id),
  lowStock: () => getAll('rawMaterials').filter((m) => m.currentStock < m.minStockLevel),
  nearExpiry: (days = 7) => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + days);
    return getAll('rawMaterials').filter((m) => m.earliestExpiry && new Date(m.earliestExpiry) <= cutoff);
  },
  create: (data: Record<string, unknown>) => create('rawMaterials', { ...data, isActive: true, currentStock: 0 }),
  update: (id: number, data: Record<string, unknown>) => update('rawMaterials', id, data),
  setConversion: (_id: number, _data: Record<string, unknown>) => ({ message: 'saved' }),
};

// ─── Purchases ────────────────────────────────────────────────────────────────

export const purchaseReceipts = {
  list: () => getAll('purchaseReceipts'),
  get: (id: number) => getById('purchaseReceipts', id),
  create: (data: Record<string, unknown>) => {
    const receipt = create('purchaseReceipts', {
      ...data,
      receipt_date: data.receiptDate ?? new Date().toISOString(),
      grand_total: data.grandTotal ?? data.grand_total ?? 0,
      grandTotal:  data.grandTotal ?? data.grand_total ?? 0,
      payment_status: data.paymentStatus ?? 'unpaid',
      amount_paid: data.amountPaid ?? 0,
      received_by_name: data.receivedByName ?? 'Shop Owner',
    });
    // Increase stock of purchased items
    const items = (data.items as Array<Record<string, unknown>>) ?? [];
    for (const item of items) {
      if (item.rawMaterialId) {
        const rm = rawMaterials.get(Number(item.rawMaterialId));
        if (rm) rawMaterials.update(Number(item.rawMaterialId), { currentStock: (rm.currentStock ?? 0) + Number(item.quantityReceived ?? item.quantity ?? 0) });
      }
    }
    return receipt;
  },
  update: (id: number, data: Record<string, unknown>) => update('purchaseReceipts', id, data),
  recordPayment: (id: number, amountPaid: number, paymentMode: string) => {
    const r = getById('purchaseReceipts', id);
    if (!r) return null;
    const total = r.grandTotal ?? r.grand_total ?? 0;
    const newPaid = amountPaid;
    const status = newPaid >= total ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
    return update('purchaseReceipts', id, { amount_paid: newPaid, payment_status: status, payment_mode: paymentMode });
  },
};

// ─── Production batches ───────────────────────────────────────────────────────

export const batches = {
  list: (params?: Record<string, unknown>) => {
    let data = getAll('batches');
    if (params?.productId) data = data.filter((b) => b.productId === params.productId);
    return data;
  },
  get: (id: number) => getById('batches', id),
  create: (data: Record<string, unknown>) => {
    // Auto-generate batch number MM-YY-NNN
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const prefix = `${mm}-${yy}`;
    const existing = state['batches'].filter((b) => b.batchNumber?.startsWith(prefix)).length;
    const batchNumber = `${prefix}-${String(existing + 1).padStart(3, '0')}`;

    const producedQty = Number(data.producedQuantity ?? data.produced_quantity ?? 0);
    const batch = create('batches', {
      ...data,
      batchNumber,
      produced_quantity: producedQty,
      production_date: data.productionDate ?? new Date().toISOString(),
      productionDate:  data.productionDate ?? new Date().toISOString(),
    });

    // Add to store stock
    const productId = Number(data.productId);
    if (productId && producedQty > 0) {
      const existing = state['stock'].find((s) => s.product_id === productId && s.batch_id === batch.id);
      if (!existing) {
        const product = products.get(productId);
        create('stock', {
          product_id:     productId,
          product_name:   product?.name ?? '',
          batch_id:       batch.id,
          batch_number:   batchNumber,
          expiry_date:    data.expiryDate ?? null,
          production_date:data.productionDate ?? new Date().toISOString(),
          store_qty:      producedQty,
          counter_qty:    0,
          currentStock:   producedQty,
          selling_unit:   product?.sellingUnit ?? 'kg',
          low_stock_level:product?.lowStockLevel ?? null,
        });
      }
    }

    return batch;
  },
  complete: (id: number, data: Record<string, unknown>) => update('batches', id, data),
};

// ─── Stock ────────────────────────────────────────────────────────────────────

export const stock = {
  list: () => getAll('stock'),
  finished: () => getAll('stock').filter((s) => s.counter_qty > 0 || s.store_qty > 0),
  expired: () => {
    const today = new Date().toISOString().split('T')[0];
    return getAll('stock').filter((s) => s.expiry_date && s.expiry_date < today);
  },
  wastage: () => [],
  /** Returns counter stock for a specific product (FEFO: earliest expiry first) */
  counterQty: (productId: number): number => {
    return getAll('stock')
      .filter((s) => s.product_id === productId)
      .reduce((sum, s) => sum + (s.counter_qty ?? 0), 0);
  },
  moveToCounter: (productId: number, batchId: number | null, qty: number) => {
    const lots = state['stock'].filter((s) =>
      s.product_id === productId && (batchId == null || s.batch_id === batchId)
    );
    if (lots.length === 0) return { error: 'No stock lot found' };
    const lot = lots[0];
    if ((lot.store_qty ?? 0) < qty) return { error: `Only ${lot.store_qty} available in store` };
    update('stock', lot.id, {
      store_qty:   (lot.store_qty ?? 0) - qty,
      counter_qty: (lot.counter_qty ?? 0) + qty,
    });
    return { ok: true };
  },
  returnToStore: (productId: number, batchId: number | null, qty: number) => {
    const lots = state['stock'].filter((s) =>
      s.product_id === productId && (batchId == null || s.batch_id === batchId)
    );
    if (lots.length === 0) return { error: 'No stock lot found' };
    const lot = lots[0];
    if ((lot.counter_qty ?? 0) < qty) return { error: `Only ${lot.counter_qty} at counter` };
    update('stock', lot.id, {
      store_qty:   (lot.store_qty ?? 0) + qty,
      counter_qty: (lot.counter_qty ?? 0) - qty,
    });
    return { ok: true };
  },
  adjust: (data: Record<string, unknown>) => {
    const productId = Number(data.productId);
    const lots = state['stock'].filter((s) => s.product_id === productId);
    if (lots.length > 0) {
      const lot = lots[0];
      const adj = Number(data.adjustmentQuantity ?? 0);
      update('stock', lot.id, {
        store_qty:   Math.max(0, (lot.store_qty ?? 0) + adj),
        counter_qty: Math.max(0, (lot.counter_qty ?? 0)),
      });
    }
    return { movementId: nextId([{ id: 0 }]) };
  },
  recordWastage: (data: Record<string, unknown>) => {
    const productId = Number(data.productId);
    const qty = Number(data.quantity ?? 0);
    const lots = state['stock'].filter((s) => s.product_id === productId);
    if (lots.length > 0) {
      const lot = lots[0];
      update('stock', lot.id, {
        counter_qty: Math.max(0, (lot.counter_qty ?? 0) - qty),
      });
    }
    return { wastageId: nextId([{ id: 0 }]) };
  },
  /** Deduct from counter (used at billing) — returns error if insufficient */
  deductFromCounter: (productId: number, qty: number): { ok: boolean; error?: string } => {
    // FEFO: sort by expiry, batches without expiry last
    const lots = getAll('stock')
      .filter((s) => s.product_id === productId && (s.counter_qty ?? 0) > 0)
      .sort((a, b) => {
        if (!a.expiry_date && !b.expiry_date) return 0;
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return a.expiry_date < b.expiry_date ? -1 : 1;
      });
    const available = lots.reduce((sum, s) => sum + (s.counter_qty ?? 0), 0);
    if (available < qty) return { ok: false, error: `Only ${available.toFixed(2)} available at counter` };
    let remaining = qty;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, lot.counter_qty ?? 0);
      update('stock', lot.id, { counter_qty: (lot.counter_qty ?? 0) - take });
      remaining -= take;
    }
    return { ok: true };
  },
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const orders = {
  list: () => getAll('orders'),
  get: (id: number) => getById('orders', id),
  productionSheet: () => {
    const today = new Date().toISOString().split('T')[0];
    return getAll('orders').filter((o) => {
      const date = o.deliveryDate ?? o.pickupDate ?? o.delivery_date ?? o.pickup_date;
      return date && date <= today;
    });
  },
  create: (data: Record<string, unknown>) => {
    const existing = getAll('orders');
    const now = new Date();
    const orderNumber = `ORD-${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(existing.length + 1).padStart(4,'0')}`;
    const total = Number(data.totalAmount ?? 0);
    const advance = Number(data.advancePaid ?? 0);
    return create('orders', {
      ...data,
      orderNumber,
      orderType: data.deliveryType === 'delivery' ? 'delivery' : 'pickup',
      totalAmount: total,
      advancePaid: advance,
      balanceDue:  total - advance,
      order_date:  data.orderDate ?? new Date().toISOString(),
    });
  },
  update: (id: number, data: Record<string, unknown>) => update('orders', id, data),
  delete: (id: number) => remove('orders', id),
};

// ─── Bills ────────────────────────────────────────────────────────────────────

export const bills = {
  list: () => getAll('bills'),
  get: (id: number) => getById('bills', id),
  create: (data: Record<string, unknown>) => {
    const existing = getAll('bills');
    const invoiceNumber = `INV-FY2026-27-${String(existing.length + 1).padStart(5, '0')}`;
    const items = (data.items as Array<Record<string, unknown>>) ?? [];
    const grandTotal = items.reduce((s, i) => {
      const base = Number(i.quantity ?? 0) * Number(i.rate ?? 0);
      const gst  = Number(i.gstRate ?? 0);
      return s + base * (1 + gst / 100);
    }, 0);

    // Deduct stock for each item
    for (const item of items) {
      if (item.productId) {
        stock.deductFromCounter(Number(item.productId), Number(item.quantity ?? 0));
      }
    }

    return create('bills', {
      ...data,
      invoiceNumber,
      billDate: new Date().toISOString(),
      status: 'paid',
      grandTotal: Math.round(grandTotal * 100) / 100,
      printCount: 0,
    });
  },
};

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const expenses = {
  list: () => getAll('expenses'),
  create: (data: Record<string, unknown>) => create('expenses', {
    ...data,
    expense_date: data.expenseDate ?? new Date().toISOString(),
    created_by_name: 'Shop Owner',
  }),
  update: (id: number, data: Record<string, unknown>) => update('expenses', id, data),
  delete: (id: number) => remove('expenses', id),
  summary: () => {
    const map: Record<string, number> = {};
    getAll('expenses').forEach((e) => { map[e.category] = (map[e.category] ?? 0) + (e.amount ?? 0); });
    return Object.entries(map).map(([category, total]) => ({ category, total }));
  },
};

// ─── Permission helpers ───────────────────────────────────────────────────────

export const ALL_PERMISSION_KEYS = [
  'dashboard', 'billing', 'orders', 'customers',
  'products', 'suppliers', 'purchases', 'rawMaterials', 'production', 'stock',
  'shifts', 'expenses', 'reports',
  'users', 'settings',
] as const;

export type PermissionKey = typeof ALL_PERMISSION_KEYS[number];

export function getAllPermissionsTrue(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  ALL_PERMISSION_KEYS.forEach((k) => { out[k] = true; });
  return out;
}

export function getDefaultPermissions(role: string): Record<string, boolean> {
  if (role === 'admin') return getAllPermissionsTrue();
  if (role === 'manager') {
    const out = getAllPermissionsTrue();
    out['settings'] = false;
    return out;
  }
  // cashier — billing + shifts only
  const out: Record<string, boolean> = {};
  ALL_PERMISSION_KEYS.forEach((k) => { out[k] = false; });
  out['billing'] = true;
  out['shifts']  = true;
  return out;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = {
  list: (includeInactive = false) => {
    const data = getAll('users');
    return includeInactive ? data : data.filter((u) => u.isActive !== false);
  },
  get: (id: number) => getById('users', id),
  create: (data: Record<string, unknown>) => {
    // assign default permissions based on role
    const role = data.role as string;
    const perms = getDefaultPermissions(role);
    return create('users', { ...data, isActive: true, permissions: perms });
  },
  update: (id: number, data: Record<string, unknown>) => update('users', id, data),
  deactivate: (id: number, reason: string) => update('users', id, { isActive: false, deactivate_reason: reason }),
  activate: (id: number) => update('users', id, { isActive: true }),
  unlock: (id: number) => update('users', id, { isLocked: false, lockedUntil: null, failed_attempts: 0 }),
  getPermissions: (id: number) => {
    const u = getById('users', id);
    if (!u) return null;
    // admin always has all permissions
    if (u.role === 'admin') return getAllPermissionsTrue();
    return u.permissions ?? getDefaultPermissions(u.role);
  },
  setPermissions: (id: number, perms: Record<string, boolean>) => {
    return update('users', id, { permissions: perms });
  },
};

// ─── Shifts ───────────────────────────────────────────────────────────────────

export const shifts = {
  list: () => getAll('shifts'),
  get: (id: number) => getById('shifts', id),
  open: (cashierId: number, openingFloat: number) => {
    return create('shifts', {
      cashier_id: cashierId,
      status: 'open',
      opened_at: new Date().toISOString(),
      opening_float: openingFloat,
      expected_cash: 0,
      counted_cash: null,
      shortage: 0,
    });
  },
  close: (id: number, countedCash: number, notes?: string, countedByName?: string) => {
    const shift = getById('shifts', id);
    if (!shift) return null;
    const expectedCash = shift.opening_float + shift.expected_cash;
    return update('shifts', id, {
      status: 'closed',
      closed_at: new Date().toISOString(),
      counted_cash: countedCash,
      shortage: countedCash - expectedCash,
      notes: notes ?? null,
      counted_by_name: countedByName ?? null,
    });
  },
  dayEnd: (id: number) => getById('shifts', id),
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export const reports = {
  salesSummary: () => {
    const today = new Date().toISOString().split('T')[0];
    const todayBills = state['bills'].filter((b) => b.billDate?.startsWith(today) && b.status !== 'cancelled');
    const totalRevenue = todayBills.reduce((s, b) => s + (b.grandTotal ?? 0), 0);
    return {
      billCount:      todayBills.length,
      totalSales:     totalRevenue * 0.85,
      totalDiscounts: 0,
      totalGst:       totalRevenue * 0.05,
      totalRevenue,
    };
  },
  pendingSupplierPayments: () => {
    const supplierMap: Record<number, { id: number; name: string; outstanding: number }> = {};
    state['purchaseReceipts'].forEach((r) => {
      const total = r.grandTotal ?? r.grand_total ?? 0;
      const paid  = r.amount_paid ?? 0;
      const owed  = total - paid;
      if (owed > 0) {
        const sid = r.supplier_id;
        if (!supplierMap[sid]) {
          const supplier = state['suppliers'].find((s) => s.id === sid);
          supplierMap[sid] = { id: sid, name: supplier?.name ?? `Supplier ${sid}`, outstanding: 0 };
        }
        supplierMap[sid].outstanding += owed;
      }
    });
    return Object.values(supplierMap).sort((a, b) => b.outstanding - a.outstanding);
  },
  lowStockAlerts: () => {
    const rmAlerts = state['rawMaterials']
      .filter((m) => m.isActive !== false && m.currentStock < m.minStockLevel)
      .map((m) => ({ id: m.id, name: m.name, baseUnit: m.baseUnit, currentStock: m.currentStock, minStockLevel: m.minStockLevel }));
    const productAlerts = state['stock']
      .filter((s) => s.low_stock_level != null && s.counter_qty <= s.low_stock_level && s.counter_qty > 0)
      .map((s) => ({ id: s.product_id, name: s.product_name, baseUnit: s.selling_unit, currentStock: s.counter_qty, minStockLevel: s.low_stock_level }));
    return [...rmAlerts, ...productAlerts];
  },
  nearExpiryBatches: () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 7);
    return state['stock']
      .filter((s) => s.expiry_date && new Date(s.expiry_date) <= cutoff && (s.counter_qty > 0 || s.store_qty > 0))
      .map((s) => ({ productName: s.product_name, batchNumber: s.batch_number, expiryDate: s.expiry_date, stock: s.counter_qty }));
  },
  ordersDue: () => {
    const today = new Date().toISOString().split('T')[0];
    return state['orders']
      .filter((o) => {
        const d = o.deliveryDate ?? o.pickupDate ?? o.delivery_date ?? o.pickup_date;
        return d && d <= today;
      })
      .map((o) => ({
        id: o.id,
        order_number: o.orderNumber,
        customer_name: o.customerName,
        balance_due: o.balanceDue ?? o.balance_due ?? 0,
        pickup_date: o.pickupDate ?? o.pickup_date,
        delivery_date: o.deliveryDate ?? o.delivery_date,
      }));
  },
};

// ─── Settings ─────────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'demo_settings';

const defaultSettings = {
  id: 1,
  shopName: 'Sweet Dreams Bakery',
  address: '42, MG Road, Pune - 411001',
  phone: '020-12345678',
  email: 'hello@sweetdreams.in',
  gstin: '27AABCU9603R1ZM',
  fssaiNumber: '10019032001234',
  invoicePrefix: 'SDR',
  invoiceFooter: 'Thank you for visiting! Return policy: exchanges within 1 hour.',
  taxInclusive: false,
  currency: 'INR',
  receiptPaper: '80mm',
  stockBlockZero: false,
  loyaltyEnabled: true,
  loyaltyPointsPerRupee: 0.5,
  loyaltyMinRedeem: 100,
  shopLogo: '',  // base64 data-URL; empty string means no logo
};

export const settings = {
  get: (): typeof defaultSettings => load<typeof defaultSettings>(SETTINGS_KEY) ?? defaultSettings,
  update: (data: Partial<typeof defaultSettings>) => {
    const current = settings.get();
    const next = { ...current, ...data };
    save(SETTINGS_KEY, next);
    return next;
  },
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = {
  alerts: () => ({
    lowStock:        reports.lowStockAlerts(),
    nearExpiry:      reports.nearExpiryBatches(),
    ordersDue:       reports.ordersDue(),
    pendingPayments: reports.pendingSupplierPayments(),
  }),
};
