import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { getPagination, paginatedResponse } from '../utils/pagination';

/** GET /api/expenses/categories */
export const listExpenseCategories = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT * FROM expense_categories WHERE restaurant_id = $1 ORDER BY name`,
    [req.auth!.restaurantId]
  );
  res.json({ success: true, data: rows });
});

/** POST /api/expenses/categories */
export const createExpenseCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO expense_categories (restaurant_id, name) VALUES ($1,$2) RETURNING *`,
    [req.auth!.restaurantId, name]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

/** GET /api/expenses?from=&to=&categoryId=&page= */
export const listExpenses = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset } = getPagination(req);
  const { from, to, categoryId } = req.query;

  const conditions = ['e.restaurant_id = $1'];
  const params: unknown[] = [req.auth!.restaurantId];
  if (from) { params.push(from); conditions.push(`e.spent_at >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`e.spent_at <= $${params.length}`); }
  if (categoryId) { params.push(categoryId); conditions.push(`e.expense_category_id = $${params.length}`); }
  const whereClause = conditions.join(' AND ');

  const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM expenses e WHERE ${whereClause}`, params);
  const total = parseInt(countRows[0].count, 10);

  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT e.*, ec.name AS category_name FROM expenses e
     JOIN expense_categories ec ON ec.id = e.expense_category_id
     WHERE ${whereClause} ORDER BY e.spent_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ success: true, ...paginatedResponse(rows, total, { page, limit, offset }) });
});

/** POST /api/expenses */
export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  const { expenseCategoryId, amount, description, isRecurring, recurrenceInterval, spentAt } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO expenses (restaurant_id, outlet_id, expense_category_id, amount, description,
                            is_recurring, recurrence_interval, spent_at, created_by)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,false),$7,$8,$9) RETURNING *`,
    [req.auth!.restaurantId, req.auth!.outletId, expenseCategoryId, amount, description ?? null,
      isRecurring, recurrenceInterval ?? null, spentAt, req.auth!.userId]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

/** DELETE /api/expenses/:id */
export const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
  await pool.query(`DELETE FROM expenses WHERE id = $1 AND restaurant_id = $2`, [req.params.id, req.auth!.restaurantId]);
  res.json({ success: true, message: 'Expense deleted' });
});
