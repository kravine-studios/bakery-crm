/**
 * Mock data for UI preview — no backend needed.
 * The api/index.ts is swapped to return these when VITE_MOCK=true.
 */

export const mockUser = {
  id: 1,
  username: 'admin',
  role: 'admin' as const,
  displayName: 'Shop Owner',
};

export const mockProducts = [
  { id: 1,  productCode: '001', name: 'Kaju Katli',                 categoryId: 1, productType: 'produced', sku: 'KK-001',   hsnCode: '2106', gstRate: 5,  sellingUnit: 'kg',     mrp: 900,  sellingPrice: 850, costPrice: 400, isWeighed: true,  foodType: 'veg',     allergens: null,              shelfLifeDays: 7,   imageUrl: null, description: null, isActive: true },
  { id: 2,  productCode: '002', name: 'Gulab Jamun',                 categoryId: 1, productType: 'produced', sku: 'GJ-001',   hsnCode: '2106', gstRate: 5,  sellingUnit: 'piece',  mrp: 20,   sellingPrice: 18,  costPrice: 8,   isWeighed: false, foodType: 'veg',     allergens: null,              shelfLifeDays: 3,   imageUrl: null, description: null, isActive: true },
  { id: 3,  productCode: '003', name: 'Chocolate Truffle Cake (1kg)',categoryId: 5, productType: 'produced', sku: 'CTC-1KG',  hsnCode: '1905', gstRate: 18, sellingUnit: 'piece',  mrp: 950,  sellingPrice: 900, costPrice: 380, isWeighed: false, foodType: 'egg',     allergens: ['gluten','dairy'], shelfLifeDays: 2,   imageUrl: null, description: null, isActive: true },
  { id: 4,  productCode: '004', name: 'Medjool Dates (500g)',        categoryId: 2, productType: 'traded',   sku: 'MD-500',   hsnCode: '0804', gstRate: 0,  sellingUnit: 'box',    mrp: 550,  sellingPrice: 499, costPrice: 280, isWeighed: false, foodType: 'veg',     allergens: null,              shelfLifeDays: 180, imageUrl: null, description: null, isActive: true },
  { id: 5,  productCode: '005', name: 'Ferrero Rocher (16pc)',       categoryId: 3, productType: 'traded',   sku: 'FR-16',    hsnCode: '1806', gstRate: 18, sellingUnit: 'box',    mrp: 450,  sellingPrice: 420, costPrice: 320, isWeighed: false, foodType: 'veg',     allergens: ['nuts','gluten'], shelfLifeDays: 90,  imageUrl: null, description: null, isActive: true },
  { id: 6,  productCode: '006', name: 'Pineapple Pastry',            categoryId: 4, productType: 'produced', sku: 'PP-001',   hsnCode: '1905', gstRate: 18, sellingUnit: 'piece',  mrp: 65,   sellingPrice: 60,  costPrice: 25,  isWeighed: false, foodType: 'egg',     allergens: ['gluten'],        shelfLifeDays: 1,   imageUrl: null, description: null, isActive: true },
  { id: 7,  productCode: '007', name: 'Motichoor Ladoo',             categoryId: 1, productType: 'produced', sku: 'ML-001',   hsnCode: '2106', gstRate: 5,  sellingUnit: 'kg',     mrp: 400,  sellingPrice: 380, costPrice: 160, isWeighed: true,  foodType: 'veg',     allergens: null,              shelfLifeDays: 5,   imageUrl: null, description: null, isActive: true },
  { id: 8,  productCode: '008', name: 'Sprite 250ml',                categoryId: 6, productType: 'traded',   sku: 'SP-250',   hsnCode: '2202', gstRate: 12, sellingUnit: 'piece',  mrp: 20,   sellingPrice: 18,  costPrice: 12,  isWeighed: false, foodType: 'veg',     allergens: null,              shelfLifeDays: 180, imageUrl: null, description: null, isActive: true },
  { id: 9,  productCode: '009', name: 'Rasgulla (1kg)',              categoryId: 1, productType: 'produced', sku: 'RG-1KG',   hsnCode: '2106', gstRate: 5,  sellingUnit: 'box',    mrp: 300,  sellingPrice: 280, costPrice: 120, isWeighed: false, foodType: 'veg',     allergens: null,              shelfLifeDays: 4,   imageUrl: null, description: null, isActive: true },
  { id: 10, productCode: '010', name: 'Almond Brittle (250g)',       categoryId: 7, productType: 'produced', sku: 'AB-250',   hsnCode: '2106', gstRate: 5,  sellingUnit: 'packet', mrp: 220,  sellingPrice: 200, costPrice: 90,  isWeighed: false, foodType: 'veg',     allergens: ['nuts'],          shelfLifeDays: 30,  imageUrl: null, description: null, isActive: true },
  { id: 11, productCode: '011', name: 'Vanilla Cupcake',             categoryId: 4, productType: 'produced', sku: 'VC-001',   hsnCode: '1905', gstRate: 18, sellingUnit: 'piece',  mrp: 80,   sellingPrice: 75,  costPrice: 28,  isWeighed: false, foodType: 'egg',     allergens: ['gluten','dairy'], shelfLifeDays: 2,  imageUrl: null, description: null, isActive: true },
  { id: 12, productCode: '012', name: 'Chakli (200g)',               categoryId: 8, productType: 'traded',   sku: 'CK-200',   hsnCode: '1905', gstRate: 12, sellingUnit: 'packet', mrp: 90,   sellingPrice: 80,  costPrice: 55,  isWeighed: false, foodType: 'veg',     allergens: ['gluten'],        shelfLifeDays: 60,  imageUrl: null, description: null, isActive: true },
];

export const mockCategories = [
  { id: 1, name: 'Sweets', parentId: null, isActive: true, sortOrder: 1 },
  { id: 2, name: 'Dates', parentId: null, isActive: true, sortOrder: 2 },
  { id: 3, name: 'Chocolates', parentId: null, isActive: true, sortOrder: 3 },
  { id: 4, name: 'Bakery Items', parentId: null, isActive: true, sortOrder: 4 },
  { id: 5, name: 'Cakes', parentId: null, isActive: true, sortOrder: 5 },
  { id: 6, name: 'Cold Drinks', parentId: null, isActive: true, sortOrder: 6 },
  { id: 7, name: 'Snacks', parentId: null, isActive: true, sortOrder: 7 },
  { id: 8, name: 'Packaged Goods', parentId: null, isActive: true, sortOrder: 8 },
];

export const mockCustomers = [
  { id: 1, name: 'Priya Sharma', phone: '9876543210', email: 'priya@example.com', birthday: '1990-03-15', anniversary: '2015-11-20', isCreditCustomer: false, creditLimit: 0, creditBalance: 0, loyaltyPoints: 420, isActive: true },
  { id: 2, name: 'Ahmed Khan', phone: '9812345678', email: null, birthday: null, anniversary: null, isCreditCustomer: true, creditLimit: 10000, creditBalance: 2500, loyaltyPoints: 1200, isActive: true },
  { id: 3, name: 'Ritu Patel', phone: '9898765432', email: 'ritu@gmail.com', birthday: '1985-07-22', anniversary: null, isCreditCustomer: false, creditLimit: 0, creditBalance: 0, loyaltyPoints: 85, isActive: true },
  { id: 4, name: 'Sunrise Caterers', phone: '9911223344', email: 'orders@sunrise.com', birthday: null, anniversary: null, isCreditCustomer: true, creditLimit: 50000, creditBalance: 15000, loyaltyPoints: 5400, isActive: true },
  { id: 5, name: 'Mehta Family', phone: '9955667788', email: null, birthday: null, anniversary: '2018-02-14', isCreditCustomer: false, creditLimit: 0, creditBalance: 0, loyaltyPoints: 230, isActive: true },
];

export const mockSuppliers = [
  { id: 1, name: 'Anand Dairy Farms', contactPerson: 'Ramesh Anand', phone: '9700112233', email: null, address: '12, APMC Road, Pune', gstin: '27AABCA1234F1Z5', paymentTerms: 'Net 7', ratingNotes: 'Fresh milk daily. Occasionally delayed.', openingBalance: 0, isActive: true },
  { id: 2, name: 'Royal Dry Fruits', contactPerson: 'Salim Sheikh', phone: '9822334455', email: 'royal@dryfruits.com', address: 'Crawford Market, Mumbai', gstin: '27BBBCS5678G2Z3', paymentTerms: 'COD', ratingNotes: 'Premium quality, no delays.', openingBalance: 4200, isActive: true },
  { id: 3, name: 'National Sugar Co.', contactPerson: 'Vijay Kulkarni', phone: '9833445566', email: null, address: 'Industrial Area, Solapur', gstin: '27CCCCT9012H3Z1', paymentTerms: 'Net 15', ratingNotes: 'Reliable. Good pricing.', openingBalance: 0, isActive: true },
  { id: 4, name: 'Mumbai Flour Mills', contactPerson: 'Dinesh Patil', phone: '9766554433', email: null, address: 'Dadar, Mumbai', gstin: null, paymentTerms: 'COD', ratingNotes: '', openingBalance: 0, isActive: true },
];

export const mockRawMaterials = [
  { id: 1, name: 'Full Cream Milk', code: 'RM-001', baseUnit: 'litre', minStockLevel: 20, shelfLifeDays: 2, costMethod: 'avg', currentStock: 45.5, earliestExpiry: '2026-10-30', isActive: true },
  { id: 2, name: 'Sugar', code: 'RM-002', baseUnit: 'kg', minStockLevel: 50, shelfLifeDays: null, costMethod: 'avg', currentStock: 120.0, earliestExpiry: null, isActive: true },
  { id: 3, name: 'Cashews (Whole)', code: 'RM-003', baseUnit: 'kg', minStockLevel: 10, shelfLifeDays: 180, costMethod: 'fifo', currentStock: 8.5, earliestExpiry: '2027-04-15', isActive: true },
  { id: 4, name: 'All-Purpose Flour', code: 'RM-004', baseUnit: 'kg', minStockLevel: 30, shelfLifeDays: 90, costMethod: 'avg', currentStock: 62.0, earliestExpiry: null, isActive: true },
  { id: 5, name: 'Pure Ghee', code: 'RM-005', baseUnit: 'kg', minStockLevel: 10, shelfLifeDays: 365, costMethod: 'avg', currentStock: 18.0, earliestExpiry: null, isActive: true },
  { id: 6, name: 'Cocoa Powder', code: 'RM-006', baseUnit: 'kg', minStockLevel: 5, shelfLifeDays: 365, costMethod: 'avg', currentStock: 3.2, earliestExpiry: null, isActive: true },
  { id: 7, name: 'Cardamom Powder', code: 'RM-007', baseUnit: 'kg', minStockLevel: 1, shelfLifeDays: 365, costMethod: 'avg', currentStock: 1.8, earliestExpiry: null, isActive: true },
  { id: 8, name: 'Rose Water', code: 'RM-008', baseUnit: 'litre', minStockLevel: 2, shelfLifeDays: 365, costMethod: 'avg', currentStock: 4.0, earliestExpiry: null, isActive: true },
];

export const mockBatches = [
  { id: 1, batchNumber: '10-26-001', productId: 1, productName: 'Kaju Katli', plannedQuantity: 10, actualQuantity: 9.8, unit: 'kg', status: 'completed', productionDate: '2026-10-25T06:00:00Z', expiryDate: '2026-11-01', productionCost: 3920, costPerUnit: 400, supervisorName: 'Ramesh Kumar', shiftId: 1 },
  { id: 2, batchNumber: '10-26-001', productId: 7, productName: 'Motichoor Ladoo', plannedQuantity: 15, actualQuantity: 14.5, unit: 'kg', status: 'completed', productionDate: '2026-10-25T08:00:00Z', expiryDate: '2026-10-30', productionCost: 2320, costPerUnit: 160, supervisorName: 'Sunita Devi', shiftId: 1 },
  { id: 3, batchNumber: '10-26-002', productId: 1, productName: 'Kaju Katli', plannedQuantity: 10, actualQuantity: null, unit: 'kg', status: 'in_progress', productionDate: '2026-10-28T06:00:00Z', expiryDate: null, productionCost: 0, costPerUnit: 0, supervisorName: 'Ramesh Kumar', shiftId: null },
  { id: 4, batchNumber: '10-26-001', productId: 9, productName: 'Rasgulla (1kg)', plannedQuantity: 50, actualQuantity: 48, unit: 'box', status: 'completed', productionDate: '2026-10-27T07:00:00Z', expiryDate: '2026-10-31', productionCost: 5760, costPerUnit: 120, supervisorName: 'Ramesh Kumar', shiftId: 2 },
];

export const mockBills = [
  { id: 1, invoiceNumber: 'INV-FY2026-27-00001', billDate: '2026-10-28T10:15:00Z', status: 'paid', customerName: 'Priya Sharma', customerPhone: '9876543210', cashierName: 'Amit Cashier', grandTotal: 1739, printCount: 1 },
  { id: 2, invoiceNumber: 'INV-FY2026-27-00002', billDate: '2026-10-28T11:30:00Z', status: 'paid', customerName: null, customerPhone: null, cashierName: 'Amit Cashier', grandTotal: 396, printCount: 1 },
  { id: 3, invoiceNumber: 'INV-FY2026-27-00003', billDate: '2026-10-28T12:45:00Z', status: 'paid', customerName: 'Ahmed Khan', customerPhone: '9812345678', cashierName: 'Priya Cashier', grandTotal: 2890, printCount: 2 },
  { id: 4, invoiceNumber: 'INV-FY2026-27-00004', billDate: '2026-10-28T14:00:00Z', status: 'held', customerName: 'Ritu Patel', customerPhone: '9898765432', cashierName: 'Amit Cashier', grandTotal: 0, printCount: 0 },
];

export const mockOrders = [
  { id: 1, orderNumber: 'ORD-10280001', customerId: 1, customerName: 'Priya Sharma', customerPhone: '9876543210', orderType: 'custom', deliveryType: 'pickup', pickupDate: '2026-10-30', deliveryDate: null, totalAmount: 1800, advancePaid: 500, balanceDue: 1300, status: 'in_production', assignedPerson: null, customisationNotes: '2kg Chocolate Truffle. "Happy Birthday Arjun" in blue. Extra moist.' },
  { id: 2, orderNumber: 'ORD-10280002', customerId: 4, customerName: 'Sunrise Caterers', customerPhone: '9911223344', orderType: 'bulk', deliveryType: 'delivery', pickupDate: null, deliveryDate: '2026-11-01', totalAmount: 18500, advancePaid: 10000, balanceDue: 8500, status: 'booked', assignedPerson: 'Ravi Driver', customisationNotes: '50 boxes Kaju Katli (500g each) for Diwali corporate gifting.' },
  { id: 3, orderNumber: 'ORD-10270003', customerId: 5, customerName: 'Mehta Family', customerPhone: '9955667788', orderType: 'custom', deliveryType: 'pickup', pickupDate: '2026-10-28', deliveryDate: null, totalAmount: 950, advancePaid: 950, balanceDue: 0, status: 'ready', assignedPerson: null, customisationNotes: '1kg Pineapple cake. "Anniversary" written.' },
];

export const mockExpenses = [
  { id: 1, expense_date: '2026-10-01T00:00:00Z', category: 'rent', amount: 25000, payment_mode: 'bank_transfer', reference_no: 'TXN12345', description: 'October shop rent', created_by_name: 'Shop Owner' },
  { id: 2, expense_date: '2026-10-05T00:00:00Z', category: 'electricity', amount: 4800, payment_mode: 'upi', reference_no: null, description: 'MSEDCL bill', created_by_name: 'Shop Owner' },
  { id: 3, expense_date: '2026-10-10T00:00:00Z', category: 'packaging', amount: 3200, payment_mode: 'cash', reference_no: null, description: 'Gift boxes and ribbons', created_by_name: 'Manager' },
  { id: 4, expense_date: '2026-10-15T00:00:00Z', category: 'gas', amount: 1800, payment_mode: 'cash', reference_no: null, description: '2 LPG cylinders', created_by_name: 'Manager' },
  { id: 5, expense_date: '2026-10-25T00:00:00Z', category: 'repairs', amount: 2500, payment_mode: 'cash', reference_no: null, description: 'Refrigerator compressor repair', created_by_name: 'Shop Owner' },
];

export const mockUsers = [
  { id: 1, username: 'admin', displayName: 'Shop Owner', role: 'admin', discountLimit: 0, isActive: true, createdAt: '2026-01-01' },
  { id: 2, username: 'manager1', displayName: 'Sunita Sharma', role: 'manager', discountLimit: 200, isActive: true, createdAt: '2026-01-05' },
  { id: 3, username: 'cashier1', displayName: 'Amit Cashier', role: 'cashier', discountLimit: 50, isActive: true, createdAt: '2026-01-10' },
  { id: 4, username: 'cashier2', displayName: 'Priya Cashier', role: 'cashier', discountLimit: 50, isActive: true, createdAt: '2026-02-01' },
  { id: 5, username: 'cashier3', displayName: 'Rohan Cashier', role: 'cashier', discountLimit: 0, isActive: false, createdAt: '2026-03-01' },
];

export const mockAlerts = {
  lowStock: [
    { id: 3, name: 'Cashews (Whole)', baseUnit: 'kg', currentStock: 8.5, minStockLevel: 10 },
    { id: 6, name: 'Cocoa Powder', baseUnit: 'kg', currentStock: 3.2, minStockLevel: 5 },
  ],
  nearExpiry: [
    { productId: 7, productName: 'Motichoor Ladoo', batchId: 2, batchNumber: '10-26-001', expiryDate: '2026-10-30', stock: 6.2 },
    { productId: 9, productName: 'Rasgulla (1kg)', batchId: 4, batchNumber: '10-26-001', expiryDate: '2026-10-31', stock: 12 },
  ],
  ordersDue: [
    { id: 3, order_number: 'ORD-10270003', customer_name: 'Mehta Family', status: 'ready' },
  ],
  pendingPayments: [
    { id: 2, name: 'Royal Dry Fruits', outstanding: 4200 },
  ],
};

export const mockSalesSummary = {
  billCount: 4,
  totalSales: 4625,
  totalDiscounts: 150,
  totalGst: 400,
  totalRevenue: 5025,
};

export const mockPurchaseReceipts = [
  { id: 1, grn_number: 'GRN-261025-0001', supplier_id: 1, supplier_name: 'Anand Dairy Farms', supplier_invoice_no: 'ADF-2234', receipt_date: '2026-10-25T08:00:00Z', grandTotal: 2025, received_by_name: 'Sunita Sharma' },
  { id: 2, grn_number: 'GRN-261025-0002', supplier_id: 2, supplier_name: 'Royal Dry Fruits', supplier_invoice_no: 'RDF-0891', receipt_date: '2026-10-25T09:30:00Z', grandTotal: 8400, received_by_name: 'Sunita Sharma' },
  { id: 3, grn_number: 'GRN-261027-0001', supplier_id: 3, supplier_name: 'National Sugar Co.', supplier_invoice_no: 'NSC-3312', receipt_date: '2026-10-27T10:00:00Z', grandTotal: 4500, received_by_name: 'Manager' },
];

export const mockStock = [
  { product_id: 1, product_name: 'Kaju Katli', batch_id: 1, batch_number: '10-26-001', expiry_date: '2026-11-01', production_date: '2026-10-25', currentStock: 7.2, selling_unit: 'kg' },
  { product_id: 7, product_name: 'Motichoor Ladoo', batch_id: 2, batch_number: '10-26-001', expiry_date: '2026-10-30', production_date: '2026-10-25', currentStock: 6.2, selling_unit: 'kg' },
  { product_id: 9, product_name: 'Rasgulla (1kg)', batch_id: 4, batch_number: '10-26-001', expiry_date: '2026-10-31', production_date: '2026-10-27', currentStock: 12, selling_unit: 'box' },
  { product_id: 4, product_name: 'Medjool Dates (500g)', batch_id: null, batch_number: null, expiry_date: null, production_date: null, currentStock: 24, selling_unit: 'box' },
  { product_id: 5, product_name: 'Ferrero Rocher (16pc)', batch_id: null, batch_number: null, expiry_date: null, production_date: null, currentStock: 18, selling_unit: 'box' },
];
