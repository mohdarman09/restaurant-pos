import { Request, Response } from 'express';
import { pool } from '../config/db';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { emitKdsUpdate } from '../realtime/socket';

/** GET /api/kds/tickets — active kitchen tickets grouped by order, oldest first */
export const listTickets = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT o.id AS order_id, o.order_number, o.order_type, o.table_id, dt.name AS table_name,
            o.is_priority, o.created_at,
            json_agg(json_build_object(
              'id', oi.id, 'productName', p.name, 'quantity', oi.quantity,
              'kitchenStatus', oi.kitchen_status, 'notes', oi.notes
            ) ORDER BY oi.created_at) AS items
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN dining_tables dt ON dt.id = o.table_id
     WHERE o.outlet_id = $1 AND o.status IN ('placed','preparing','ready')
       AND oi.kitchen_status != 'served'
     GROUP BY o.id, dt.name
     ORDER BY o.is_priority DESC, o.created_at ASC`,
    [req.auth!.outletId]
  );
  res.json({ success: true, data: rows });
});

/** PATCH /api/kds/items/:itemId/status — advance an item through new -> preparing -> ready -> served */
export const updateItemStatus = asyncHandler(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const { status } = req.body;

  const { rows } = await pool.query(
    `UPDATE order_items SET kitchen_status = $1 WHERE id = $2 RETURNING order_id`,
    [status, itemId]
  );
  if (!rows[0]) throw ApiError.notFound('Order item not found');
  const orderId = rows[0].order_id;

  // Roll the parent order's overall status up based on its items' statuses
  const { rows: statusRows } = await pool.query(
    `SELECT DISTINCT kitchen_status FROM order_items WHERE order_id = $1`,
    [orderId]
  );
  const statuses: string[] = statusRows.map((r: { kitchen_status: string }) => r.kitchen_status);
  let orderStatus: string | null = null;
  if (statuses.every((s) => s === 'served')) orderStatus = 'served';
  else if (statuses.every((s) => s === 'ready' || s === 'served')) orderStatus = 'ready';
  else if (statuses.some((s) => s === 'preparing')) orderStatus = 'preparing';

  if (orderStatus) {
    await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 AND status NOT IN ('completed','cancelled')`,
      [orderStatus, orderId]
    );
  }

  if (req.auth!.outletId) emitKdsUpdate(req.auth!.outletId);
  res.json({ success: true, message: 'Item status updated' });
});

/** PATCH /api/kds/orders/:orderId/priority */
export const setPriority = asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { isPriority } = req.body;
  await pool.query(`UPDATE orders SET is_priority = $1 WHERE id = $2`, [isPriority, orderId]);
  if (req.auth!.outletId) emitKdsUpdate(req.auth!.outletId);
  res.json({ success: true, message: 'Priority updated' });
});
