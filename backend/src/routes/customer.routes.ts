import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { listCustomers, createCustomer, getCustomerHistory } from '../controllers/customer.controller';

const router = Router();
router.use(authenticate);

router.get('/', listCustomers);
router.get('/:id', getCustomerHistory);
router.post('/', validate(z.object({
  fullName: z.string().min(1), phone: z.string().optional(), email: z.string().email().optional(),
  dateOfBirth: z.string().optional(),
})), createCustomer);

export default router;
