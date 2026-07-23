import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  salesReport, orderReport, productReport, inventoryReport, financialReport, customerReport, employeeReport,
} from '../controllers/report.controller';

const router = Router();
router.use(authenticate);
router.use(requireRole('super_admin', 'owner', 'manager'));

router.get('/sales', salesReport);
router.get('/orders', orderReport);
router.get('/products', productReport);
router.get('/inventory', inventoryReport);
router.get('/financial', financialReport);
router.get('/customers', customerReport);
router.get('/employees', employeeReport);

export default router;
