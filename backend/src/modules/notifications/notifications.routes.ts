import { Router } from 'express';
import { notificationsController } from './notifications.controller';

const router = Router();

router.get('/alerts', notificationsController.alerts);

export default router;
