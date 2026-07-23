import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';

/** GET /api/settings — returns all settings as a flat key->value object */
export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT key, value FROM settings WHERE restaurant_id = $1`,
    [req.auth!.restaurantId]
  );
  const settings: Record<string, unknown> = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json({ success: true, data: settings });
});

/** PUT /api/settings — bulk upsert (used by the Settings page save button) */
export const bulkUpsertSettings = asyncHandler(async (req: Request, res: Response) => {
  const entries = req.body as Record<string, unknown>;
  const restaurantId = req.auth!.restaurantId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(entries)) {
      await client.query(
        `INSERT INTO settings (restaurant_id, key, value) VALUES ($1,$2,$3)
         ON CONFLICT (restaurant_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [restaurantId, key, JSON.stringify(value)]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({ success: true, message: 'Settings saved' });
});
