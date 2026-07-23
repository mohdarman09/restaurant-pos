import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getSummary, getSalesTrend } from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);
router.get('/summary', getSummary);
router.get('/sales-trend', getSalesTrend);

export default router;
