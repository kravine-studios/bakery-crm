/**
 * demoSeed — canonical demo dataset.
 * Dates are RELATIVE TO TODAY so the demo always shows
 * "Orders Due Today", "Near Expiry" items etc.
 */

function daysFromToday(delta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return d.toISOString().split('T')[0];
}

function isoToday(delta = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return d.toISOString();
}

export function seedDemoData() {

  // ── Products ────────────────────────────────────────────────────
  const products = [
    { id: 1,  productCode: '001', name: 'Kaju Katli',                  categoryId: 1, productType: 'produced', sku: 'KK-001',  hsnCode: '2106', gstRate: 5,  sellingUnit: 'kg',     sellingPrice: 850, costPrice: 400, isWeighed: true,  foodType: 'veg', isActive: true, shelfLifeDays: 7,   lowStockLevel: 5 },
    { id: 2,  productCode: '002', name: 'Gulab Jamun',                  categoryId: 1, productType: 'produced', sku: 'GJ-001',  hsnCode: '2106', gstRate: 5,  sellingUnit: 'piece',  sellingPrice: 18,  costPrice: 8,   isWeighed: false, foodType: 'veg', isActive: true, shelfLifeDays: 3,   lowStockLevel: 10 },
    { id: 3,  productCode: '003', name: 'Chocolate Truffle Cake (1kg)', categoryId: 5, productType: 'produced', sku: 'CTC-1KG', hsnCode: '1905', gstRate: 18, sellingUnit: 'piece',  sellingPrice: 900, costPrice: 380, isWeighed: false, foodType: 'egg', isActive: true, shelfLifeDays: 2,   lowStockLevel: 2 },
    { id: 4,  productCode: '004', name: 'Medjool Dates (500g)',         categoryId: 2, productType: 'traded',   sku: 'MD-500',  hsnCode: '0804', gstRate: null, sellingUnit: 'box',  sellingPrice: 499, costPrice: 280, isWeighed: false, foodType: 'veg', isActive: true, shelfLifeDays: 180, lowStockLevel: 5 },
    { id: 5,  productCode: '005', name: 'Ferrero Rocher (16pc)',        categoryId: 3, productType: 'traded',   sku: 'FR-16',   hsnCode: '1806', gstRate: 18, sellingUnit: 'box',    sellingPrice: 420, costPrice: 320, isWeighed: false, foodType: 'veg', isActive: true, shelfLifeDays: 90,  lowStockLevel: 4 },
    { id: 6,  productCode: '006', name: 'Pineapple Pastry',             categoryId: 4, productType: 'produced', sku: 'PP-001',  hsnCode: '1905', gstRate: 18, sellingUnit: 'piece',  sellingPrice: 60,  costPrice: 25,  isWeighed: false, foodType: 'egg', isActive: true, shelfLifeDays: 1,   lowStockLevel: 5 },
    { id: 7,  productCode: '007', name: 'Motichoor Ladoo',              categoryId: 1, productType: 'produced', sku: 'ML-001',  hsnCode: '2106', gstRate: 5,  sellingUnit: 'kg',     sellingPrice: 380, costPrice: 160, isWeighed: true,  foodType: 'veg', isActive: true, shelfLifeDays: 5,   lowStockLevel: 5 },
    { id: 8,  productCode: '008', name: 'Sprite 250ml',                 categoryId: 6, productType: 'traded',   sku: 'SP-250',  hsnCode: '2202', gstRate: 12, sellingUnit: 'piece',  sellingPrice: 18,  costPrice: 12,  isWeighed: false, foodType: 'veg', isActive: true, shelfLifeDays: 180, lowStockLevel: null },
    { id: 9,  productCode: '009', name: 'Rasgulla (1kg)',               categoryId: 1, productType: 'produced', sku: 'RG-1KG',  hsnCode: '2106', gstRate: 5,  sellingUnit: 'box',    sellingPrice: 280, costPrice: 120, isWeighed: false, foodType: 'veg', isActive: true, shelfLifeDays: 4,   lowStockLevel: 3 },
    { id: 10, productCode: '010', name: 'Almond Brittle (250g)',        categoryId: 7, productType: 'produced', sku: 'AB-250',  hsnCode: '2106', gstRate: 5,  sellingUnit: 'packet', sellingPrice: 200, costPrice: 90,  isWeighed: false, foodType: 'veg', isActive: true, shelfLifeDays: 30,  lowStockLevel: null },
    { id: 11, productCode: '011', name: 'Vanilla Cupcake',              categoryId: 4, productType: 'produced', sku: 'VC-001',  hsnCode: '1905', gstRate: 18, sellingUnit: 'piece',  sellingPrice: 75,  costPrice: 28,  isWeighed: false, foodType: 'egg', isActive: true, shelfLifeDays: 2,   lowStockLevel: 5 },
    { id: 12, productCode: '012', name: 'Chakli (200g)',                categoryId: 8, productType: 'traded',   sku: 'CK-200',  hsnCode: '1905', gstRate: 12, sellingUnit: 'packet', sellingPrice: 80,  costPrice: 55,  isWeighed: false, foodType: 'veg', isActive: true, shelfLifeDays: 60,  lowStockLevel: null },
  ];

  // ── Categories ──────────────────────────────────────────────────
  const categories = [
    { id: 1, name: 'Sweets',         parentId: null, isActive: true, sortOrder: 1 },
    { id: 2, name: 'Dates',          parentId: null, isActive: true, sortOrder: 2 },
    { id: 3, name: 'Chocolates',     parentId: null, isActive: true, sortOrder: 3 },
    { id: 4, name: 'Bakery Items',   parentId: null, isActive: true, sortOrder: 4 },
    { id: 5, name: 'Cakes',          parentId: null, isActive: true, sortOrder: 5 },
    { id: 6, name: 'Cold Drinks',    parentId: null, isActive: true, sortOrder: 6 },
    { id: 7, name: 'Snacks',         parentId: null, isActive: true, sortOrder: 7 },
    { id: 8, name: 'Packaged Goods', parentId: null, isActive: true, sortOrder: 8 },
  ];

  // ── Customers ───────────────────────────────────────────────────
  const customers = [
    { id: 1, name: 'Priya Sharma',    phone: '9876543210', email: 'priya@example.com', birthday: '1990-03-15', anniversary: '2015-11-20', isCreditCustomer: false, creditLimit: 0,     creditBalance: 0,     loyaltyPoints: 420,  isActive: true },
    { id: 2, name: 'Ahmed Khan',      phone: '9812345678', email: null,                birthday: null,          anniversary: null,          isCreditCustomer: true,  creditLimit: 10000, creditBalance: 2500,  loyaltyPoints: 1200, isActive: true },
    { id: 3, name: 'Ritu Patel',      phone: '9898765432', email: 'ritu@gmail.com',    birthday: '1985-07-22', anniversary: null,          isCreditCustomer: false, creditLimit: 0,     creditBalance: 0,     loyaltyPoints: 85,   isActive: true },
    { id: 4, name: 'Sunrise Caterers',phone: '9911223344', email: 'orders@sunrise.com',birthday: null,          anniversary: null,          isCreditCustomer: true,  creditLimit: 50000, creditBalance: 15000, loyaltyPoints: 5400, isActive: true },
    { id: 5, name: 'Mehta Family',    phone: '9955667788', email: null,                birthday: null,          anniversary: '2018-02-14', isCreditCustomer: false, creditLimit: 0,     creditBalance: 0,     loyaltyPoints: 230,  isActive: true },
  ];

  // ── Raw Materials (expanded for supplier products supplied) ──────
  const rawMaterials = [
    { id: 1,  name: 'Full Cream Milk',      code: 'RM-001', baseUnit: 'litre',  minStockLevel: 20,  currentStock: 45.5, earliestExpiry: daysFromToday(2),  shelfLifeDays: 2,   costMethod: 'avg', isActive: true },
    { id: 2,  name: 'Sugar',                code: 'RM-002', baseUnit: 'kg',     minStockLevel: 50,  currentStock: 220.0,earliestExpiry: null,               shelfLifeDays: null,costMethod: 'avg', isActive: true },
    { id: 3,  name: 'Cashews (Whole)',       code: 'RM-003', baseUnit: 'kg',     minStockLevel: 10,  currentStock: 18.5, earliestExpiry: daysFromToday(90), shelfLifeDays: 180, costMethod: 'fifo',isActive: true },
    { id: 4,  name: 'All-Purpose Flour',    code: 'RM-004', baseUnit: 'kg',     minStockLevel: 30,  currentStock: 62.0, earliestExpiry: null,               shelfLifeDays: 90,  costMethod: 'avg', isActive: true },
    { id: 5,  name: 'Pure Ghee',            code: 'RM-005', baseUnit: 'kg',     minStockLevel: 10,  currentStock: 18.0, earliestExpiry: null,               shelfLifeDays: 365, costMethod: 'avg', isActive: true },
    { id: 6,  name: 'Cocoa Powder',         code: 'RM-006', baseUnit: 'kg',     minStockLevel: 5,   currentStock: 3.2,  earliestExpiry: null,               shelfLifeDays: 365, costMethod: 'avg', isActive: true },
    { id: 7,  name: 'Cardamom Powder',      code: 'RM-007', baseUnit: 'kg',     minStockLevel: 1,   currentStock: 1.8,  earliestExpiry: null,               shelfLifeDays: 365, costMethod: 'avg', isActive: true },
    { id: 8,  name: 'Rose Water',           code: 'RM-008', baseUnit: 'litre',  minStockLevel: 2,   currentStock: 4.0,  earliestExpiry: null,               shelfLifeDays: 365, costMethod: 'avg', isActive: true },
    { id: 9,  name: 'Paneer',               code: 'RM-009', baseUnit: 'kg',     minStockLevel: 5,   currentStock: 8.0,  earliestExpiry: daysFromToday(3),  shelfLifeDays: 5,   costMethod: 'avg', isActive: true },
    { id: 10, name: 'Butter',               code: 'RM-010', baseUnit: 'kg',     minStockLevel: 3,   currentStock: 6.0,  earliestExpiry: null,               shelfLifeDays: 30,  costMethod: 'avg', isActive: true },
    { id: 11, name: 'Almonds',              code: 'RM-011', baseUnit: 'kg',     minStockLevel: 5,   currentStock: 8.0,  earliestExpiry: null,               shelfLifeDays: 365, costMethod: 'fifo',isActive: true },
    { id: 12, name: 'Pistachios',           code: 'RM-012', baseUnit: 'kg',     minStockLevel: 3,   currentStock: 4.5,  earliestExpiry: null,               shelfLifeDays: 365, costMethod: 'fifo',isActive: true },
    { id: 13, name: 'Raisins',              code: 'RM-013', baseUnit: 'kg',     minStockLevel: 5,   currentStock: 10.0, earliestExpiry: null,               shelfLifeDays: 365, costMethod: 'avg', isActive: true },
    { id: 14, name: 'Jaggery',             code: 'RM-014', baseUnit: 'kg',     minStockLevel: 20,  currentStock: 50.0, earliestExpiry: null,               shelfLifeDays: null,costMethod: 'avg', isActive: true },
    { id: 15, name: 'Maida',               code: 'RM-015', baseUnit: 'kg',     minStockLevel: 20,  currentStock: 80.0, earliestExpiry: null,               shelfLifeDays: 90,  costMethod: 'avg', isActive: true },
    { id: 16, name: 'Wheat Flour',         code: 'RM-016', baseUnit: 'kg',     minStockLevel: 30,  currentStock: 60.0, earliestExpiry: null,               shelfLifeDays: 90,  costMethod: 'avg', isActive: true },
    { id: 17, name: 'Semolina (Sooji)',     code: 'RM-017', baseUnit: 'kg',     minStockLevel: 10,  currentStock: 25.0, earliestExpiry: null,               shelfLifeDays: 90,  costMethod: 'avg', isActive: true },
    { id: 18, name: 'Besan',               code: 'RM-018', baseUnit: 'kg',     minStockLevel: 10,  currentStock: 20.0, earliestExpiry: null,               shelfLifeDays: 90,  costMethod: 'avg', isActive: true },
  ];

  // ── Suppliers with suppliedItems ────────────────────────────────
  const suppliers = [
    {
      id: 1, name: 'Anand Dairy Farms', contactPerson: 'Ramesh Anand', phone: '9700112233',
      email: null, address: '12, APMC Road, Pune', gstin: '27AABCA1234F1Z5', paymentTerms: 'Net 7',
      ratingNotes: 'Fresh milk daily. Occasionally delayed.', isActive: true,
      suppliedItems: [
        { id: 1, itemName: 'Full Cream Milk', rawMaterialId: 1,  unit: 'litre', usualRate: 55  },
        { id: 2, itemName: 'Paneer',           rawMaterialId: 9,  unit: 'kg',    usualRate: 250 },
        { id: 3, itemName: 'Pure Ghee',        rawMaterialId: 5,  unit: 'kg',    usualRate: 550 },
        { id: 4, itemName: 'Butter',           rawMaterialId: 10, unit: 'kg',    usualRate: 480 },
      ],
    },
    {
      id: 2, name: 'Royal Dry Fruits', contactPerson: 'Salim Sheikh', phone: '9822334455',
      email: 'royal@dryfruits.com', address: 'Crawford Market, Mumbai', gstin: '27BBBCS5678G2Z3', paymentTerms: 'COD',
      ratingNotes: 'Premium quality, no delays.', isActive: true,
      suppliedItems: [
        { id: 5, itemName: 'Cashews (Whole)', rawMaterialId: 3,  unit: 'kg', usualRate: 700 },
        { id: 6, itemName: 'Almonds',         rawMaterialId: 11, unit: 'kg', usualRate: 700 },
        { id: 7, itemName: 'Pistachios',      rawMaterialId: 12, unit: 'kg', usualRate: 900 },
        { id: 8, itemName: 'Raisins',         rawMaterialId: 13, unit: 'kg', usualRate: 200 },
        { id: 9, itemName: 'Medjool Dates',   productId:     4,  unit: 'box',usualRate: 499 },
      ],
    },
    {
      id: 3, name: 'National Sugar Co.', contactPerson: 'Vijay Kulkarni', phone: '9833445566',
      email: null, address: 'Industrial Area, Solapur', gstin: '27CCCCT9012H3Z1', paymentTerms: 'Net 15',
      ratingNotes: 'Reliable. Good pricing.', isActive: true,
      suppliedItems: [
        { id: 10, itemName: 'Sugar',        rawMaterialId: 2,  unit: 'kg', usualRate: 45  },
        { id: 11, itemName: 'Jaggery',      rawMaterialId: 14, unit: 'kg', usualRate: 60  },
        { id: 12, itemName: 'Cocoa Powder', rawMaterialId: 6,  unit: 'kg', usualRate: 350 },
      ],
    },
    {
      id: 4, name: 'Mumbai Flour Mills', contactPerson: 'Dinesh Patil', phone: '9766554433',
      email: null, address: 'Dadar, Mumbai', gstin: null, paymentTerms: 'COD',
      ratingNotes: '', isActive: true,
      suppliedItems: [
        { id: 13, itemName: 'Maida',           rawMaterialId: 15, unit: 'kg', usualRate: 38 },
        { id: 14, itemName: 'Wheat Flour',     rawMaterialId: 16, unit: 'kg', usualRate: 32 },
        { id: 15, itemName: 'Semolina (Sooji)',rawMaterialId: 17, unit: 'kg', usualRate: 42 },
        { id: 16, itemName: 'Besan',           rawMaterialId: 18, unit: 'kg', usualRate: 65 },
      ],
    },
  ];

  // ── Purchase receipts (matching items & correct totals) ─────────
  const purchaseReceipts = [
    {
      id: 1, grn_number: 'GRN-001', bill_number: 'ADF-2234', supplier_id: 1,
      supplier_name: 'Anand Dairy Farms', supplier_invoice_no: 'ADF-2234',
      receipt_date: isoToday(-5), grandTotal: 2025, grand_total: 2025,
      payment_status: 'paid', amount_paid: 2025, payment_mode: 'upi',
      received_by_name: 'Sunita Sharma',
      notes: '',
      items: [
        { id: 1, receipt_id: 1, raw_material_id: 1, raw_material_name: 'Full Cream Milk', quantity_received: 30, unit: 'litre', rate: 55, line_amount: 1650, gst_rate: 0 },
        { id: 2, receipt_id: 1, raw_material_id: 9, raw_material_name: 'Paneer',           quantity_received: 1.5, unit: 'kg',   rate: 250, line_amount: 375,  gst_rate: 0 },
      ],
    },
    {
      id: 2, grn_number: 'GRN-002', bill_number: 'RDF-0891', supplier_id: 2,
      supplier_name: 'Royal Dry Fruits', supplier_invoice_no: 'RDF-0891',
      receipt_date: isoToday(-3), grandTotal: 8400, grand_total: 8400,
      payment_status: 'unpaid', amount_paid: 0, payment_mode: null,
      received_by_name: 'Sunita Sharma',
      notes: '',
      items: [
        { id: 3, receipt_id: 2, raw_material_id: 3,  raw_material_name: 'Cashews (Whole)', quantity_received: 10, unit: 'kg', rate: 700, line_amount: 7000, gst_rate: 5 },
        { id: 4, receipt_id: 2, raw_material_id: 11, raw_material_name: 'Almonds',         quantity_received: 2,  unit: 'kg', rate: 700, line_amount: 1400, gst_rate: 5 },
      ],
    },
    {
      id: 3, grn_number: 'GRN-003', bill_number: 'NSC-3312', supplier_id: 3,
      supplier_name: 'National Sugar Co.', supplier_invoice_no: 'NSC-3312',
      receipt_date: isoToday(-2), grandTotal: 4500, grand_total: 4500,
      payment_status: 'partial', amount_paid: 2000, payment_mode: 'cash',
      received_by_name: 'Shop Owner',
      notes: '',
      items: [
        { id: 5, receipt_id: 3, raw_material_id: 2, raw_material_name: 'Sugar', quantity_received: 100, unit: 'kg', rate: 45, line_amount: 4500, gst_rate: 0 },
      ],
    },
  ];

  // ── Production batches ──────────────────────────────────────────
  const batches = [
    { id: 1, batchNumber: '10-26-001', productId: 1, productName: 'Kaju Katli',     produced_quantity: 100, unit: 'kg',    production_date: isoToday(-3), productionDate: isoToday(-3), expiryDate: daysFromToday(7), cost_per_kg: 400, costPerUnit: 400, selling_price_per_unit: 850, supervisorName: 'Shop Owner', shiftId: 1 },
    { id: 2, batchNumber: '10-26-002', productId: 7, productName: 'Motichoor Ladoo',produced_quantity: 15,  unit: 'kg',    production_date: isoToday(-5), productionDate: isoToday(-5), expiryDate: daysFromToday(3), cost_per_kg: 160, costPerUnit: 160, selling_price_per_unit: 380, supervisorName: 'Shop Owner', shiftId: 1 },
    { id: 3, batchNumber: '10-26-003', productId: 9, productName: 'Rasgulla (1kg)', produced_quantity: 50,  unit: 'box',   production_date: isoToday(-1), productionDate: isoToday(-1), expiryDate: daysFromToday(4), cost_per_kg: 120, costPerUnit: 120, selling_price_per_unit: 280, supervisorName: 'Shop Owner', shiftId: null },
    { id: 4, batchNumber: '10-26-004', productId: 2, productName: 'Gulab Jamun',    produced_quantity: 200, unit: 'piece', production_date: isoToday(-1), productionDate: isoToday(-1), expiryDate: daysFromToday(3), cost_per_kg: 8,   costPerUnit: 8,   selling_price_per_unit: 18,  supervisorName: 'Shop Owner', shiftId: null },
  ];

  // ── Stock (store + counter per batch) ───────────────────────────
  // Reflects the required demo states from Part E:
  // Kaju Katli: counter 20, store 80; Motichoor Ladoo: counter 3.5 (LOW), store 11.5
  // Rasgulla: counter 0 (OUT OF STOCK), store 50; Gulab Jamun: counter 60, store 140
  const stock = [
    // Kaju Katli — normal (counter 20, store 80)
    { id: 1,  product_id: 1, product_name: 'Kaju Katli',                  batch_id: 1, batch_number: '10-26-001', expiry_date: daysFromToday(7),  production_date: isoToday(-3), store_qty: 80,  counter_qty: 20,  currentStock: 100, selling_unit: 'kg',     low_stock_level: 5 },
    // Gulab Jamun — normal (counter 60, store 140)
    { id: 2,  product_id: 2, product_name: 'Gulab Jamun',                  batch_id: 4, batch_number: '10-26-004', expiry_date: daysFromToday(3),  production_date: isoToday(-1), store_qty: 140, counter_qty: 60,  currentStock: 200, selling_unit: 'piece',  low_stock_level: 10 },
    // Chocolate Truffle Cake — normal (counter 4)
    { id: 3,  product_id: 3, product_name: 'Chocolate Truffle Cake (1kg)', batch_id: null, batch_number: null, expiry_date: daysFromToday(2),  production_date: isoToday(-1), store_qty: 8,   counter_qty: 4,   currentStock: 12,  selling_unit: 'piece',  low_stock_level: 2 },
    // Medjool Dates — normal (counter 12)
    { id: 4,  product_id: 4, product_name: 'Medjool Dates (500g)',         batch_id: null, batch_number: null, expiry_date: null,              production_date: null,          store_qty: 36,  counter_qty: 12,  currentStock: 48,  selling_unit: 'box',    low_stock_level: 5 },
    // Ferrero Rocher — normal (counter 15)
    { id: 5,  product_id: 5, product_name: 'Ferrero Rocher (16pc)',        batch_id: null, batch_number: null, expiry_date: null,              production_date: null,          store_qty: 25,  counter_qty: 15,  currentStock: 40,  selling_unit: 'box',    low_stock_level: 4 },
    // Pineapple Pastry — normal (counter 18)
    { id: 6,  product_id: 6, product_name: 'Pineapple Pastry',             batch_id: null, batch_number: null, expiry_date: daysFromToday(1),  production_date: null,          store_qty: 10,  counter_qty: 18,  currentStock: 28,  selling_unit: 'piece',  low_stock_level: 5 },
    // Motichoor Ladoo — LOW (counter 3.5, low level 5)
    { id: 7,  product_id: 7, product_name: 'Motichoor Ladoo',              batch_id: 2, batch_number: '10-26-002', expiry_date: daysFromToday(3),  production_date: isoToday(-5), store_qty: 11.5,counter_qty: 3.5, currentStock: 15,  selling_unit: 'kg',     low_stock_level: 5 },
    // Sprite — normal (counter 24)
    { id: 8,  product_id: 8, product_name: 'Sprite 250ml',                 batch_id: null, batch_number: null, expiry_date: null,              production_date: null,          store_qty: 48,  counter_qty: 24,  currentStock: 72,  selling_unit: 'piece',  low_stock_level: null },
    // Rasgulla — OUT OF STOCK (counter 0)
    { id: 9,  product_id: 9, product_name: 'Rasgulla (1kg)',               batch_id: 3, batch_number: '10-26-003', expiry_date: daysFromToday(4),  production_date: isoToday(-1), store_qty: 50,  counter_qty: 0,   currentStock: 50,  selling_unit: 'box',    low_stock_level: 3 },
    // Almond Brittle — normal (counter 9)
    { id: 10, product_id: 10,product_name: 'Almond Brittle (250g)',        batch_id: null, batch_number: null, expiry_date: null,              production_date: null,          store_qty: 20,  counter_qty: 9,   currentStock: 29,  selling_unit: 'packet', low_stock_level: null },
    // Vanilla Cupcake — LOW (counter 2, low level 5)
    { id: 11, product_id: 11,product_name: 'Vanilla Cupcake',              batch_id: null, batch_number: null, expiry_date: daysFromToday(2),  production_date: null,          store_qty: 10,  counter_qty: 2,   currentStock: 12,  selling_unit: 'piece',  low_stock_level: 5 },
    // Chakli — normal (counter 30)
    { id: 12, product_id: 12,product_name: 'Chakli (200g)',                batch_id: null, batch_number: null, expiry_date: null,              production_date: null,          store_qty: 40,  counter_qty: 30,  currentStock: 70,  selling_unit: 'packet', low_stock_level: null },
  ];

  // ── Orders (relative dates) ─────────────────────────────────────
  const orders = [
    {
      id: 1, orderNumber: 'ORD-001', customerId: 1, customerName: 'Priya Sharma', customerPhone: '9876543210',
      deliveryType: 'pickup', orderType: 'pickup',
      pickupDate: daysFromToday(0), deliveryDate: null, deliveryAddress: null,
      totalAmount: 1800, advancePaid: 500, balanceDue: 1300,
      notes: '2kg Chocolate Truffle. "Happy Birthday Arjun" in blue.',
    },
    {
      id: 2, orderNumber: 'ORD-002', customerId: 4, customerName: 'Sunrise Caterers', customerPhone: '9911223344',
      deliveryType: 'delivery', orderType: 'delivery',
      pickupDate: null, deliveryDate: daysFromToday(3), deliveryAddress: 'Baner Road, Pune – 411045',
      totalAmount: 18500, advancePaid: 10000, balanceDue: 8500,
      notes: '50 boxes Kaju Katli (500g) for Diwali corporate gifting.',
    },
    {
      id: 3, orderNumber: 'ORD-003', customerId: 5, customerName: 'Mehta Family', customerPhone: '9955667788',
      deliveryType: 'pickup', orderType: 'pickup',
      pickupDate: daysFromToday(1), deliveryDate: null, deliveryAddress: null,
      totalAmount: 950, advancePaid: 950, balanceDue: 0,
      notes: '1kg Pineapple cake. "Anniversary" written.',
    },
  ];

  // ── Bills ───────────────────────────────────────────────────────
  const bills = [
    { id: 1, invoiceNumber: 'SDR-FY26-00001', billDate: isoToday(-2), status: 'paid', customerName: 'Priya Sharma',    customerPhone: '9876543210', cashierName: 'Amit Cashier',  grandTotal: 1739, printCount: 1 },
    { id: 2, invoiceNumber: 'SDR-FY26-00002', billDate: isoToday(-1), status: 'paid', customerName: null,              customerPhone: null,         cashierName: 'Amit Cashier',  grandTotal: 396,  printCount: 1 },
    { id: 3, invoiceNumber: 'SDR-FY26-00003', billDate: isoToday(0),  status: 'paid', customerName: 'Ahmed Khan',      customerPhone: '9812345678', cashierName: 'Priya Cashier', grandTotal: 2890, printCount: 1 },
  ];

  // ── Expenses ────────────────────────────────────────────────────
  const expenses = [
    { id: 1, expense_date: isoToday(-30), category: 'rent',        amount: 25000, payment_mode: 'bank_transfer', description: 'October shop rent',     created_by_name: 'Shop Owner' },
    { id: 2, expense_date: isoToday(-25), category: 'electricity', amount: 4800,  payment_mode: 'upi',           description: 'MSEDCL bill',           created_by_name: 'Shop Owner' },
    { id: 3, expense_date: isoToday(-20), category: 'packaging',   amount: 3200,  payment_mode: 'cash',          description: 'Gift boxes and ribbons', created_by_name: 'Sunita Sharma' },
    { id: 4, expense_date: isoToday(-15), category: 'gas',         amount: 1800,  payment_mode: 'cash',          description: '2 LPG cylinders',       created_by_name: 'Sunita Sharma' },
    { id: 5, expense_date: isoToday(-5),  category: 'repairs',     amount: 2500,  payment_mode: 'cash',          description: 'Refrigerator repair',   created_by_name: 'Shop Owner' },
  ];

  // ── Users ───────────────────────────────────────────────────────
  const adminPerms: Record<string, boolean> = { dashboard: true, billing: true, orders: true, customers: true, products: true, suppliers: true, purchases: true, rawMaterials: true, production: true, stock: true, shifts: true, expenses: true, reports: true, users: true, settings: true };
  const managerPerms: Record<string, boolean> = { ...adminPerms, settings: false };
  const cashierPerms: Record<string, boolean> = { dashboard: false, billing: true, orders: false, customers: false, products: false, suppliers: false, purchases: false, rawMaterials: false, production: false, stock: false, shifts: true, expenses: false, reports: false, users: false, settings: false };

  const users = [
    { id: 1, username: 'admin',    displayName: 'Shop Owner',    role: 'admin',   isActive: true,  createdAt: isoToday(-200), lastLoginAt: isoToday(0),  lastLoginTab: 'owner', isLocked: false, lockedUntil: null, passwordFingerprint: 'a3f9c1d2', permissions: adminPerms },
    { id: 2, username: 'manager1', displayName: 'Sunita Sharma', role: 'manager', isActive: true,  createdAt: isoToday(-180), lastLoginAt: isoToday(-1), lastLoginTab: 'staff', isLocked: false, lockedUntil: null, passwordFingerprint: 'b7e4f912', permissions: managerPerms },
    { id: 3, username: 'cashier1', displayName: 'Amit Cashier',  role: 'cashier', isActive: true,  createdAt: isoToday(-150), lastLoginAt: isoToday(0),  lastLoginTab: 'staff', isLocked: false, lockedUntil: null, passwordFingerprint: 'c2a8e047', permissions: cashierPerms },
    { id: 4, username: 'cashier2', displayName: 'Priya Cashier', role: 'cashier', isActive: true,  createdAt: isoToday(-120), lastLoginAt: isoToday(-1), lastLoginTab: 'staff', isLocked: false, lockedUntil: null, passwordFingerprint: 'd5f1b293', permissions: cashierPerms },
    { id: 5, username: 'cashier3', displayName: 'Rohan Cashier', role: 'cashier', isActive: false, createdAt: isoToday(-90),  lastLoginAt: null,         lastLoginTab: null,    isLocked: false, lockedUntil: null, passwordFingerprint: 'e8c3a165', permissions: cashierPerms },
  ];

  // ── Shifts ──────────────────────────────────────────────────────
  const shifts = [
    { id: 1, cashier_id: 3, cashier_name: 'Amit Cashier',  status: 'closed', opened_at: isoToday(-1) + 'T09:00:00Z', closed_at: isoToday(-1) + 'T18:00:00Z', opening_float: 1000, expected_cash: 5800, counted_cash: 5750, shortage: -50,  notes: '' },
    { id: 2, cashier_id: 4, cashier_name: 'Priya Cashier', status: 'open',   opened_at: isoToday(0)  + 'T09:15:00Z', closed_at: null,                         opening_float: 1000, expected_cash: 2890, counted_cash: null, shortage: 0,    notes: '' },
  ];

  return { products, categories, customers, suppliers, rawMaterials, purchaseReceipts, batches, stock, orders, bills, expenses, users, shifts };
}
