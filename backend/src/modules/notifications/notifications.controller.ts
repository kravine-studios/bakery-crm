import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { getAlerts } from './notifications.service';

export const notificationsController = {
  alerts: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await getAlerts());
  }),
};
