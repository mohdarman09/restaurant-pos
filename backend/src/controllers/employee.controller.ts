import { Request, Response } from 'express';
import { pool } from '../config/db';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

/** GET /api/employees — profiles with role and last login */
export const listEmployees = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.last_login_at, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.restaurant_id = $1 AND u.deleted_at IS NULL ORDER BY u.full_name`,
    [req.auth!.restaurantId]
  );
  res.json({ success: true, data: rows });
});

/** POST /api/employees/attendance/check-in */
export const checkIn = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.body.userId ?? req.auth!.userId;
  const { rows } = await pool.query(
    `INSERT INTO attendance (user_id, check_in, work_date) VALUES ($1, now(), current_date)
     ON CONFLICT (user_id, work_date) DO UPDATE SET check_in = EXCLUDED.check_in
     RETURNING *`,
    [userId]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

/** POST /api/employees/attendance/check-out */
export const checkOut = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.body.userId ?? req.auth!.userId;
  const { rows } = await pool.query(
    `UPDATE attendance SET check_out = now() WHERE user_id = $1 AND work_date = current_date RETURNING *`,
    [userId]
  );
  if (!rows[0]) throw ApiError.badRequest('No check-in record found for today');
  res.json({ success: true, data: rows[0] });
});

/** GET /api/employees/attendance?from=&to= */
export const listAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const conditions = ['u.restaurant_id = $1'];
  const params: unknown[] = [req.auth!.restaurantId];
  if (from) { params.push(from); conditions.push(`a.work_date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`a.work_date <= $${params.length}`); }

  const { rows } = await pool.query(
    `SELECT a.*, u.full_name FROM attendance a JOIN users u ON u.id = a.user_id
     WHERE ${conditions.join(' AND ')} ORDER BY a.work_date DESC, u.full_name LIMIT 200`,
    params
  );
  res.json({ success: true, data: rows });
});

/** Shifts */
export const listShifts = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(`SELECT * FROM shifts WHERE outlet_id = $1 ORDER BY start_time`, [req.auth!.outletId]);
  res.json({ success: true, data: rows });
});

export const createShift = asyncHandler(async (req: Request, res: Response) => {
  const { name, startTime, endTime } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO shifts (outlet_id, name, start_time, end_time) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.auth!.outletId, name, startTime, endTime]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

export const assignShift = asyncHandler(async (req: Request, res: Response) => {
  const { userId, shiftId, workDate } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO employee_shifts (user_id, shift_id, work_date) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, work_date) DO UPDATE SET shift_id = EXCLUDED.shift_id RETURNING *`,
    [userId, shiftId, workDate]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

/** GET /api/employees/salary — each employee's most recent base salary */
export const listCurrentSalaries = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (u.id) u.id AS user_id, u.full_name, s.base_salary, s.effective_from
     FROM users u
     LEFT JOIN salaries s ON s.user_id = u.id
     WHERE u.restaurant_id = $1 AND u.deleted_at IS NULL
     ORDER BY u.id, s.effective_from DESC NULLS LAST`,
    [req.auth!.restaurantId]
  );
  res.json({ success: true, data: rows });
});

/** Salary */
export const setSalary = asyncHandler(async (req: Request, res: Response) => {
  const { userId, baseSalary, effectiveFrom } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO salaries (user_id, base_salary, effective_from) VALUES ($1,$2,$3) RETURNING *`,
    [userId, baseSalary, effectiveFrom]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

export const listSalaryPayments = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT sp.*, u.full_name FROM salary_payments sp JOIN users u ON u.id = sp.user_id
     WHERE u.restaurant_id = $1 ORDER BY sp.period_month DESC LIMIT 100`,
    [req.auth!.restaurantId]
  );
  res.json({ success: true, data: rows });
});

export const recordSalaryPayment = asyncHandler(async (req: Request, res: Response) => {
  const { userId, periodMonth, amount } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO salary_payments (user_id, period_month, amount, paid_at, status)
     VALUES ($1,$2,$3, now(), 'paid') RETURNING *`,
    [userId, periodMonth, amount]
  );
  res.status(201).json({ success: true, data: rows[0] });
});
