import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getSettings, bulkUpsertSettings } from '../controllers/settings.controller';

const router = Router();
router.use(authenticate);

router.get('/', getSettings);
router.put('/', requireRole('super_admin', 'owner'), validate(z.record(z.unknown())), bulkUpsertSettings);

export default router;
