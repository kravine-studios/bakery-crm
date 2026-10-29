import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { OrderStatus } from '../../types/enums';
import { listOrders, getOrderById, createOrder, updateOrderStatus, getDailyProductionSheet } from './order.service';

export const createValidation = [
  body('customerId').isInt({ min: 1 }),
  body('items').isArray({ min: 1 }),
  body('items.*.itemName').isString().notEmpty(),
  body('items.*.quantity').isFloat({ min: 0.001 }),
  body('items.*.unit').isString(),
  body('items.*.rate').isFloat({ min: 0 }),
  body('advancePaid').optional().isFloat({ min: 0 }),
  body('deliveryDate').optional().isISO8601(),
  body('pickupDate').optional().isISO8601(),
  validate,
];

export const statusValidation = [
  body('status').isIn(['booked', 'in_production', 'ready', 'delivered', 'cancelled']),
  validate,
];

export const orderController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    res.json(await listOrders({
      status: req.query.status as OrderStatus | undefined,
      deliveryDate: req.query.date as string | undefined,
    }));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    res.json(await getOrderById(parseInt(req.params.id, 10)));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(201).json(await createOrder({ ...req.body, createdBy: req.user.id, req }));
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await updateOrderStatus({
      orderId: parseInt(req.params.id, 10),
      status: req.body.status as OrderStatus,
      updatedBy: req.user.id,
      req,
    }));
  }),

  productionSheet: asyncHandler(async (req: Request, res: Response) => {
    res.json(await getDailyProductionSheet(req.query.date as string | undefined));
  }),
};
