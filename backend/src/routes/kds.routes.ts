import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { listTickets, updateItemStatus, setPriority } from '../controllers/kds.controller';

const router = Router();
router.use(authenticate);

router.get('/tickets', listTickets);
router.patch('/items/:itemId/status', validate(z.object({
  status: z.enum(['new', 'preparing', 'ready', 'served']),
})), updateItemStatus);
router.patch('/orders/:orderId/priority', validate(z.object({ isPriority: z.boolean() })), setPriority);

export default router;
