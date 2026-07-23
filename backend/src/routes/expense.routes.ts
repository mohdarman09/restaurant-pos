import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  listExpenseCategories, createExpenseCategory, listExpenses, createExpense, deleteExpense,
} from '../controllers/expense.controller';

const router = Router();
router.use(authenticate);
const canManage = requireRole('super_admin', 'owner', 'manager');

router.get('/categories', listExpenseCategories);
router.post('/categories', canManage, validate(z.object({ name: z.string().min(1) })), createExpenseCategory);

router.get('/', listExpenses);
router.post('/', canManage, validate(z.object({
  expenseCategoryId: z.string().uuid(),
  amount: z.number().positive(),
  description: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceInterval: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  spentAt: z.string(),
})), createExpense);
router.delete('/:id', canManage, deleteExpense);

export default router;
