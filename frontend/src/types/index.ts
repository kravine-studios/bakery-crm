// ── Shared frontend types matching the backend models ────

export interface Product {
  id: number;
  name: string;
  categoryId: number;
  productType: 'produced' | 'traded';
  sku: string | null;
  hsnCode: string | null;
  gstRate: number;
  sellingUnit: string;
  mrp: number | null;
  sellingPrice: number;
  costPrice: number;
  isWeighed: boolean;
  foodType: 'veg' | 'non_veg' | 'egg';
  allergens: string[] | null;
  shelfLifeDays: number | null;
  imageUrl: string | null;
  description: string | null;
  isActive: boolean;
}

export interface Variant {
  id: number;
  productId: number;
  name: string;
  unit: string;
  weightValue: number | null;
  sellingPrice: number;
  costPrice: number;
  mrp: number | null;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface Supplier {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  paymentTerms: string | null;
  ratingNotes: string | null;
  openingBalance: number;
  isActive: boolean;
}

export interface RawMaterial {
  id: number;
  name: string;
  code: string | null;
  baseUnit: string;
  minStockLevel: number;
  shelfLifeDays: number | null;
  costMethod: 'avg' | 'fifo';
  currentStock: number;
  earliestExpiry: string | null;
  isActive: boolean;
}

export interface Recipe {
  id: number;
  name: string;
  productId: number;
  productName: string;
  batchSize: number;
  batchUnit: string;
  expectedYield: number;
  yieldUnit: string;
  allowedWastagePct: number;
  isActive: boolean;
  isDefault: boolean;
  items: Array<{
    id: number;
    rawMaterialId: number;
    rawMaterialName: string;
    quantity: number;
    unit: string;
    notes: string | null;
  }>;
}

export interface ProductionBatch {
  id: number;
  batchNumber: string;
  productId: number;
  productName: string;
  recipeId: number;
  plannedQuantity: number;
  actualQuantity: number | null;
  unit: string;
  status: 'planned' | 'in_progress' | 'completed' | 'closed';
  productionDate: string;
  completedDate: string | null;
  expiryDate: string | null;
  productionCost: number;
  costPerUnit: number;
  supervisorName: string;
  shiftId: number | null;
  notes: string | null;
}

export interface Bill {
  id: number;
  invoiceNumber: string;
  billDate: string;
  status: 'open' | 'held' | 'paid' | 'cancelled' | 'returned';
  subtotal: number;
  totalDiscount: number;
  totalCgst: number;
  totalSgst: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string | null;
  customerName: string | null;
  customerPhone: string | null;
  cashierName: string;
  printCount: number;
  items: BillItem[];
  payments: Payment[];
}

export interface BillItem {
  id: number;
  productId: number | null;
  variantId: number | null;
  comboId: number | null;
  batchId: number | null;
  name: string;
  hsnCode: string | null;
  quantity: number;
  unit: string;
  rate: number;
  baseAmount: number;
  discountAmount: number;
  taxableValue: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
  lineCost: number;
  notes: string | null;
}

export interface Payment {
  id: number;
  paymentMode: 'cash' | 'upi' | 'card' | 'wallet' | 'credit';
  amount: number;
  referenceNo: string | null;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  anniversary: string | null;
  isCreditCustomer: boolean;
  creditLimit: number;
  creditBalance: number;
  loyaltyPoints: number;
  isActive: boolean;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  orderType: 'custom' | 'bulk' | 'festival';
  deliveryType: 'pickup' | 'delivery';
  pickupDate: string | null;
  deliveryDate: string | null;
  totalAmount: number;
  advancePaid: number;
  balanceDue: number;
  status: 'booked' | 'in_production' | 'ready' | 'delivered' | 'cancelled';
  assignedPerson: string | null;
  customisationNotes: string | null;
}

export interface Shift {
  id: number;
  cashierId: number;
  cashierName: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
  openingFloat: number;
  expectedCash: number | null;
  countedCash: number | null;
  shortage: number | null;
  notes: string | null;
}

export interface Settings {
  id: number;
  shopName: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  fssaiNumber: string | null;
  invoicePrefix: string;
  invoiceFooter: string;
  taxInclusive: boolean;
  currency: string;
  receiptPaper: '58mm' | '80mm' | 'A4';
  stockBlockZero: boolean;
  loyaltyEnabled: boolean;
  loyaltyPointsPerRupee: number;
  loyaltyMinRedeem: number;
}
