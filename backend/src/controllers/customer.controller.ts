import { Request, Response } from 'express';
import { pool } from '../config/db';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { getPagination, paginatedResponse } from '../utils/pagination';

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset } = getPagination(req);
  const { search } = req.query;
  const conditions = ['restaurant_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [req.auth!.restaurantId];
  if (search) { params.push(`%${search}%`); conditions.push(`(full_name ILIKE $${params.length} OR phone ILIKE $${params.length})`); }

  const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM customers WHERE ${conditions.join(' AND ')}`, params);
  const total = parseInt(countRows[0].count, 10);

  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT * FROM customers WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ success: true, ...paginatedResponse(rows, total, { page, limit, offset }) });
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { fullName, phone, email, dateOfBirth } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO customers (restaurant_id, full_name, phone, email, date_of_birth) VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [req.auth!.restaurantId, fullName, phone ?? null, email ?? null, dateOfBirth ?? null]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

export const getCustomerHistory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rows: customerRows } = await pool.query(
    `SELECT * FROM customers WHERE id = $1 AND restaurant_id = $2`,
    [id, req.auth!.restaurantId]
  );
  if (!customerRows[0]) throw ApiError.notFound('Customer not found');

  const { rows: orderRows } = await pool.query(
    `SELECT id, order_number, total_amount, status, completed_at FROM orders
     WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [id]
  );
  res.json({ success: true, data: { ...customerRows[0], orders: orderRows } });
});
