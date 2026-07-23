import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  listTables, updateTableStatus, transferTable, mergeTables, listReservations, createReservation,
} from '../controllers/table.controller';

const router = Router();
router.use(authenticate);

router.get('/', listTables);
router.patch('/:id/status', validate(z.object({
  status: z.enum(['available', 'occupied', 'reserved', 'cleaning']),
})), updateTableStatus);
router.post('/:id/transfer', validate(z.object({ targetTableId: z.string().uuid() })), transferTable);
router.post('/merge', validate(z.object({
  tableIds: z.array(z.string().uuid()).min(2),
  primaryTableId: z.string().uuid(),
})), mergeTables);

router.get('/reservations/list', listReservations);
router.post('/reservations', validate(z.object({
  tableId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
  partySize: z.number().int().positive().optional(),
  reservedFor: z.string(),
  notes: z.string().optional(),
})), createReservation);

export default router;
