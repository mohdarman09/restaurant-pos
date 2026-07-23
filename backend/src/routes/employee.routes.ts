import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  listEmployees, checkIn, checkOut, listAttendance,
  listShifts, createShift, assignShift, setSalary, listCurrentSalaries, listSalaryPayments, recordSalaryPayment,
} from '../controllers/employee.controller';

const router = Router();
router.use(authenticate);
const canManage = requireRole('super_admin', 'owner', 'manager');

router.get('/', listEmployees);

router.post('/attendance/check-in', validate(z.object({ userId: z.string().uuid().optional() })), checkIn);
router.post('/attendance/check-out', validate(z.object({ userId: z.string().uuid().optional() })), checkOut);
router.get('/attendance', listAttendance);

router.get('/shifts', listShifts);
router.post('/shifts', canManage, validate(z.object({
  name: z.string().min(1), startTime: z.string(), endTime: z.string(),
})), createShift);
router.post('/shifts/assign', canManage, validate(z.object({
  userId: z.string().uuid(), shiftId: z.string().uuid(), workDate: z.string(),
})), assignShift);

router.post('/salary', canManage, validate(z.object({
  userId: z.string().uuid(), baseSalary: z.number().nonnegative(), effectiveFrom: z.string(),
})), setSalary);
router.get('/salary/current', canManage, listCurrentSalaries);
router.get('/salary/payments', canManage, listSalaryPayments);
router.post('/salary/payments', canManage, validate(z.object({
  userId: z.string().uuid(), periodMonth: z.string(), amount: z.number().positive(),
})), recordSalaryPayment);

export default router;
