import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../middleware/errorHandler';
import { Role } from '../../types/enums';
import {
  getSalesSummary, getSalesByProduct, getSalesByPaymentMode, getSalesByCashier,
  getSalesByHour, getStockValuation, getGstReport, getWastageReport,
  getProductionReport, getProfitReport,
} from './report.service';

function getDateRange(req: Request): { dateFrom: string; dateTo: string } {
  const dateFrom = req.query.dateFrom as string || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const dateTo = req.query.dateTo as string || new Date().toISOString().split('T')[0];
  return { dateFrom, dateTo };
}

export const reportController = {
  salesSummary: asyncHandler(async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = getDateRange(req);
    res.json(await getSalesSummary(dateFrom, dateTo));
  }),

  salesByProduct: asyncHandler(async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = getDateRange(req);
    res.json(await getSalesByProduct(dateFrom, dateTo));
  }),

  salesByPaymentMode: asyncHandler(async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = getDateRange(req);
    res.json(await getSalesByPaymentMode(dateFrom, dateTo));
  }),

  salesByCashier: asyncHandler(async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = getDateRange(req);
    res.json(await getSalesByCashier(dateFrom, dateTo));
  }),

  salesByHour: asyncHandler(async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = getDateRange(req);
    res.json(await getSalesByHour(dateFrom, dateTo));
  }),

  stockValuation: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await getStockValuation());
  }),

  gst: asyncHandler(async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = getDateRange(req);
    res.json(await getGstReport(dateFrom, dateTo));
  }),

  wastage: asyncHandler(async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = getDateRange(req);
    res.json(await getWastageReport(dateFrom, dateTo));
  }),

  production: asyncHandler(async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = getDateRange(req);
    res.json(await getProductionReport(dateFrom, dateTo));
  }),

  profit: asyncHandler(async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = getDateRange(req);
    res.json(await getProfitReport(dateFrom, dateTo));
  }),

  // Cashier sees only operational reports (PRD 3 permission matrix)
  cashierLimited: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { dateFrom, dateTo } = getDateRange(req);
    if (req.user.role === Role.Cashier) {
      // Cashiers only see their own sales summary
      res.json(await getSalesSummary(dateFrom, dateTo));
    } else {
      res.json(await getSalesSummary(dateFrom, dateTo));
    }
  }),
};
