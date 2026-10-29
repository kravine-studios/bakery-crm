import { Router } from 'express';
import { settingsController, updateValidation } from './settings.controller';

const router = Router();

router.get('/', settingsController.get);
router.put('/', updateValidation, settingsController.update);
router.get('/audit-log', settingsController.auditLog);

export default router;
