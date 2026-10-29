import { Request, Response } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { listCustomers, getCustomerById, findOrCreateByPhone, createCustomer, updateCustomer, getCustomerHistory } from './customer.service';

export const createValidation = [
  body('name').isString().trim().notEmpty(),
  body('phone').isString().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('birthday').optional().isISO8601(),
  body('anniversary').optional().isISO8601(),
  body('creditLimit').optional().isFloat({ min: 0 }),
  validate,
];

export const updateValidation = [
  body('name').optional().isString().trim().notEmpty(),
  body('phone').optional().isString(),
  body('email').optional().isEmail(),
  body('creditLimit').optional().isFloat({ min: 0 }),
  body('isActive').optional().isBoolean(),
  validate,
];

export const customerController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    res.json(await listCustomers({
      search: req.query.search as string | undefined,
      isCredit: req.query.credit === 'true' ? true : req.query.credit === 'false' ? false : undefined,
    }));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    res.json(await getCustomerById(parseInt(req.params.id, 10)));
  }),

  findByPhone: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const phone = req.query.phone as string;
    if (!phone) return res.status(400).json({ error: 'Phone query param required' });
    res.json(await findOrCreateByPhone(phone, req.query.name as string | undefined, req, req.user.id));
  }),

  history: asyncHandler(async (req: Request, res: Response) => {
    res.json(await getCustomerHistory(parseInt(req.params.id, 10)));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.status(201).json(await createCustomer({ ...req.body, createdBy: req.user.id, req }));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await updateCustomer({ ...req.body, id: parseInt(req.params.id, 10), updatedBy: req.user.id, req }));
  }),
};
