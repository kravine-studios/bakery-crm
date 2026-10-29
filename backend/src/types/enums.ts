/**
 * System-wide enumerated values. Kept in one place so the DB,
 * API layer, and frontend share a single source of truth.
 */

export enum Role {
  Admin = 'admin',
  Manager = 'manager',
  Cashier = 'cashier',
}

export const ROLE_RANK: Record<Role, number> = {
  [Role.Admin]: 3,
  [Role.Manager]: 2,
  [Role.Cashier]: 1,
};

export enum ProductType {
  Produced = 'produced',
  Traded = 'traded',
}

export enum SellingUnit {
  Piece = 'piece',
  Kg = 'kg',
  Gram = 'gram',
  Box = 'box',
  Dozen = 'dozen',
  Litre = 'litre',
  Ml = 'ml',
  Packet = 'packet',
}

export enum FoodType {
  Veg = 'veg',
  NonVeg = 'non_veg',
  Egg = 'egg',
}

export enum BatchStatus {
  Planned = 'planned',
  InProgress = 'in_progress',
  Completed = 'completed',
  Closed = 'closed',
}

export enum StockMovementType {
  Production = 'production',
  Sale = 'sale',
  Return = 'return',
  Wastage = 'wastage',
  Adjustment = 'adjustment',
  Purchase = 'purchase',
  PurchaseReturn = 'purchase_return',
  Transfer = 'transfer',
}

export enum WastageReason {
  Expired = 'expired',
  Damaged = 'damaged',
  Sampling = 'sampling',
  Spillage = 'spillage',
  StaffConsumption = 'staff_consumption',
}

export enum PaymentMode {
  Cash = 'cash',
  Upi = 'upi',
  Card = 'card',
  Wallet = 'wallet',
  Credit = 'credit',
}

export enum BillStatus {
  Open = 'open',
  Held = 'held',
  Paid = 'paid',
  Cancelled = 'cancelled',
  Returned = 'returned',
}

export enum OrderStatus {
  Booked = 'booked',
  InProduction = 'in_production',
  Ready = 'ready',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}

export enum ShiftStatus {
  Open = 'open',
  Closed = 'closed',
}

export enum CashEntryType {
  In = 'cash_in',
  Out = 'cash_out',
}

export enum ExpenseCategory {
  Electricity = 'electricity',
  Rent = 'rent',
  Salaries = 'salaries',
  Gas = 'gas',
  Packaging = 'packaging',
  Transport = 'transport',
  Repairs = 'repairs',
  Others = 'others',
}

export enum AuditAction {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  Cancel = 'cancel',
  Restore = 'restore',
  Login = 'login',
  Logout = 'logout',
}
