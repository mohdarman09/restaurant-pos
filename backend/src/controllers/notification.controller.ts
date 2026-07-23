import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';

/** GET /api/notifications — mine + broadcast (user_id IS NULL) notifications, newest first */
export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE restaurant_id = $1 AND (user_id = $2 OR user_id IS NULL)
     ORDER BY created_at DESC LIMIT 50`,
    [req.auth!.restaurantId, req.auth!.userId]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM notifications WHERE restaurant_id = $1 AND (user_id = $2 OR user_id IS NULL) AND is_read = false`,
    [req.auth!.restaurantId, req.auth!.userId]
  );
  res.json({ success: true, data: rows, unreadCount: parseInt(countRows[0].count, 10) });
});

/** PATCH /api/notifications/:id/read */
export const markRead = asyncHandler(async (req: Request, res: Response) => {
  await pool.query(`UPDATE notifications SET is_read = true WHERE id = $1`, [req.params.id]);
  res.json({ success: true });
});

/** PATCH /api/notifications/read-all */
export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await pool.query(
    `UPDATE notifications SET is_read = true WHERE restaurant_id = $1 AND (user_id = $2 OR user_id IS NULL)`,
    [req.auth!.restaurantId, req.auth!.userId]
  );
  res.json({ success: true });
});
