import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { ApiError } from '../../middleware/errorHandler';
import { BillStatus, PaymentMode, Role } from '../../types/enums';
import {
  createBill, holdBill, resumeBill, listBills, getBillById, cancelBill, recordPrint,
} from './billing.service';

export const createBillValidation = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.name').isString().notEmpty(),
  body('items.*.quantity').isFloat({ min: 0.001 }),
  body('items.*.unit').isString().notEmpty(),
  body('items.*.rate').isFloat({ min: 0 }),
  body('items.*.gstRate').isFloat({ min: 0, max: 100 }),
  body('payments').isArray({ min: 1 }).withMessage('At least one payment is required'),
  body('payments.*.paymentMode').isIn(['cash', 'upi', 'card', 'wallet', 'credit']),
  body('payments.*.amount').isFloat({ min: 0 }),
  body('customerId').optional().isInt({ min: 1 }),
  body('customerName').optional().isString(),
  body('customerPhone').optional().isString(),
  body('notes').optional().isString(),
  validate,
];

export const holdBillValidation = [
  body('items').isArray({ min: 1 }),
  body('items.*.name').isString().notEmpty(),
  body('items.*.quantity').isFloat({ min: 0.001 }),
  body('items.*.rate').isFloat({ min: 0 }),
  validate,
];

export const cancelBillValidation = [
  body('reason').isString().trim().notEmpty().withMessage('Reason is required for cancellation'),
  validate,
];

export const billingController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const result = await createBill({
      items: req.body.items,
      payments: req.body.payments,
      customerId: req.body.customerId,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      notes: req.body.notes,
      cashierId: req.user.id,
      shiftId: req.body.shiftId,
      req,
    });
    res.status(201).json(result);
  }),

  hold: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const result = await holdBill({
      items: req.body.items,
      customerId: req.body.customerId,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      notes: req.body.notes,
      cashierId: req.user.id,
      req,
    });
    res.status(201).json(result);
  }),

  resume: asyncHandler(async (req: Request, res: Response) => {
    const result = await resumeBill(parseInt(req.params.id, 10));
    res.json(result);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      status: req.query.status as BillStatus | undefined,
      cashierId: req.query.cashierId ? parseInt(req.query.cashierId as string, 10) : undefined,
      customerId: req.query.customerId ? parseInt(req.query.customerId as string, 10) : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    };
    const bills = await listBills(filters);
    res.json(bills);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const bill = await getBillById(parseInt(req.params.id, 10));
    res.json(bill);
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    // Cashiers can only request cancellation, manager/admin approves (PRD 3)
    const approvedBy = req.user.role === Role.Cashier
      ? (req.body.approvedBy ?? (() => { throw new ApiError(403, 'Cashier cancellation requires manager approval'); })())
      : req.user.id;
    await cancelBill({
      billId: parseInt(req.params.id, 10),
      reason: req.body.reason,
      cancelledBy: req.user.id,
      approvedBy,
      req,
    });
    res.json({ message: 'Bill cancelled' });
  }),

  print: asyncHandler(async (req: Request, res: Response) => {
    const result = await recordPrint(parseInt(req.params.id, 10));
    res.json(result);
  }),
};
