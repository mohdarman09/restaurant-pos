import { Request, Response } from 'express';
import { pool } from '../config/db';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { emitTablesUpdate } from '../realtime/socket';

/** GET /api/tables — live floor layout with status, for the outlet the user belongs to */
export const listTables = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT dt.id, dt.name, dt.capacity, dt.pos_x, dt.pos_y, dt.status, dt.merged_into, f.name AS floor_name,
            o.id AS active_order_id, o.total_amount AS active_order_total
     FROM dining_tables dt
     JOIN floors f ON f.id = dt.floor_id
     LEFT JOIN orders o ON o.table_id = dt.id AND o.status NOT IN ('completed','cancelled')
     WHERE f.outlet_id = $1
     ORDER BY f.name, dt.name`,
    [req.auth!.outletId]
  );
  res.json({ success: true, data: rows });
});

/** PATCH /api/tables/:id/status */
export const updateTableStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const { rows } = await pool.query(
    `UPDATE dining_tables SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );
  if (!rows[0]) throw ApiError.notFound('Table not found');
  if (req.auth!.outletId) emitTablesUpdate(req.auth!.outletId);
  res.json({ success: true, data: rows[0] });
});

/** POST /api/tables/:id/transfer — move an active order to another table */
export const transferTable = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params; // source table id
  const { targetTableId } = req.body;

  const { rows: orderRows } = await pool.query(
    `SELECT id FROM orders WHERE table_id = $1 AND status NOT IN ('completed','cancelled') LIMIT 1`,
    [id]
  );
  if (!orderRows[0]) throw ApiError.notFound('No active order on source table');

  await pool.query(`UPDATE orders SET table_id = $1 WHERE id = $2`, [targetTableId, orderRows[0].id]);
  await pool.query(`UPDATE dining_tables SET status = 'occupied' WHERE id = $1`, [targetTableId]);
  await pool.query(`UPDATE dining_tables SET status = 'cleaning' WHERE id = $1`, [id]);

  if (req.auth!.outletId) emitTablesUpdate(req.auth!.outletId);
  res.json({ success: true, message: 'Table transferred' });
});

/** POST /api/tables/merge — merge multiple tables into one active order */
export const mergeTables = asyncHandler(async (req: Request, res: Response) => {
  const { tableIds, primaryTableId } = req.body as { tableIds: string[]; primaryTableId: string };
  for (const tableId of tableIds) {
    if (tableId === primaryTableId) continue;
    await pool.query(`UPDATE dining_tables SET merged_into = $1, status = 'occupied' WHERE id = $2`, [primaryTableId, tableId]);
  }
  if (req.auth!.outletId) emitTablesUpdate(req.auth!.outletId);
  res.json({ success: true, message: 'Tables merged' });
});

/** GET/POST /api/reservations */
export const listReservations = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT r.* FROM reservations r JOIN dining_tables dt ON dt.id = r.table_id
     JOIN floors f ON f.id = dt.floor_id WHERE f.outlet_id = $1 ORDER BY r.reserved_for DESC LIMIT 100`,
    [req.auth!.outletId]
  );
  res.json({ success: true, data: rows });
});

export const createReservation = asyncHandler(async (req: Request, res: Response) => {
  const { tableId, customerId, guestName, guestPhone, partySize, reservedFor, notes } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO reservations (table_id, customer_id, guest_name, guest_phone, party_size, reserved_for, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [tableId, customerId ?? null, guestName ?? null, guestPhone ?? null, partySize ?? 2, reservedFor, notes ?? null]
  );
  await pool.query(`UPDATE dining_tables SET status = 'reserved' WHERE id = $1`, [tableId]);
  res.status(201).json({ success: true, data: rows[0] });
});
