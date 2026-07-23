import { Request, Response } from 'express';
import { pool } from '../config/db';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

/** GET /api/inventory/raw-materials */
export const listRawMaterials = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT rm.id, rm.name, rm.current_stock, rm.reorder_level, u.abbreviation AS unit,
            (rm.current_stock <= rm.reorder_level) AS is_low_stock
     FROM raw_materials rm JOIN units u ON u.id = rm.unit_id
     WHERE rm.restaurant_id = $1 AND rm.deleted_at IS NULL ORDER BY rm.name`,
    [req.auth!.restaurantId]
  );
  res.json({ success: true, data: rows });
});

/** POST /api/inventory/raw-materials */
export const createRawMaterial = asyncHandler(async (req: Request, res: Response) => {
  const { name, unitId, reorderLevel } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO raw_materials (restaurant_id, name, unit_id, reorder_level) VALUES ($1,$2,$3,COALESCE($4,0))
     RETURNING *`,
    [req.auth!.restaurantId, name, unitId, reorderLevel]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

/** POST /api/inventory/stock-movements — stock in / stock out / adjustment / wastage / transfer */
export const recordStockMovement = asyncHandler(async (req: Request, res: Response) => {
  const { rawMaterialId, movementType, quantity, notes, expiryDate, batchNo } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sign = ['stock_in', 'transfer_in'].includes(movementType) ? 1 : -1;

    await client.query(
      `UPDATE raw_materials SET current_stock = current_stock + $1 WHERE id = $2`,
      [sign * quantity, rawMaterialId]
    );
    const { rows } = await client.query(
      `INSERT INTO stock_movements (raw_material_id, outlet_id, movement_type, quantity, notes,
                                     expiry_date, batch_no, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [rawMaterialId, req.auth!.outletId, movementType, quantity, notes ?? null, expiryDate ?? null,
        batchNo ?? null, req.auth!.userId]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/** GET /api/inventory/stock-movements?rawMaterialId= */
export const listStockMovements = asyncHandler(async (req: Request, res: Response) => {
  const { rawMaterialId } = req.query;
  const conditions = ['rm.restaurant_id = $1'];
  const params: unknown[] = [req.auth!.restaurantId];
  if (rawMaterialId) { params.push(rawMaterialId); conditions.push(`sm.raw_material_id = $${params.length}`); }

  const { rows } = await pool.query(
    `SELECT sm.*, rm.name AS raw_material_name FROM stock_movements sm
     JOIN raw_materials rm ON rm.id = sm.raw_material_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY sm.created_at DESC LIMIT 200`,
    params
  );
  res.json({ success: true, data: rows });
});

/** Suppliers CRUD (minimal) */
export const listSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT * FROM suppliers WHERE restaurant_id = $1 AND deleted_at IS NULL ORDER BY name`,
    [req.auth!.restaurantId]
  );
  res.json({ success: true, data: rows });
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const { name, contactPerson, phone, email, address, gstin } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO suppliers (restaurant_id, name, contact_person, phone, email, address, gstin)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.auth!.restaurantId, name, contactPerson ?? null, phone ?? null, email ?? null, address ?? null, gstin ?? null]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

/** Purchase orders */
export const createPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const { supplierId, items } = req.body as {
    supplierId: string;
    items: { rawMaterialId: string; quantity: number; unitPrice: number }[];
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) + 1 AS seq FROM purchase_orders WHERE restaurant_id = $1`,
      [req.auth!.restaurantId]
    );
    const poNumber = `PO-${String(countRows[0].seq).padStart(5, '0')}`;
    const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

    const { rows: poRows } = await client.query(
      `INSERT INTO purchase_orders (restaurant_id, supplier_id, po_number, status, total_amount, created_by)
       VALUES ($1,$2,$3,'ordered',$4,$5) RETURNING *`,
      [req.auth!.restaurantId, supplierId, poNumber, total, req.auth!.userId]
    );
    const po = poRows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, raw_material_id, quantity_ordered, unit_price)
         VALUES ($1,$2,$3,$4)`,
        [po.id, item.rawMaterialId, item.quantity, item.unitPrice]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: po });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/** POST /api/inventory/purchase-orders/:id/receive — GRN: mark received & increase stock */
export const receivePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: itemRows } = await client.query(
      `SELECT * FROM purchase_order_items WHERE purchase_order_id = $1`,
      [id]
    );
    if (itemRows.length === 0) throw ApiError.notFound('Purchase order has no items');

    for (const item of itemRows) {
      await client.query(
        `UPDATE raw_materials SET current_stock = current_stock + $1 WHERE id = $2`,
        [item.quantity_ordered, item.raw_material_id]
      );
      await client.query(
        `INSERT INTO stock_movements (raw_material_id, movement_type, quantity, reference_type, reference_id, created_by)
         VALUES ($1,'stock_in',$2,'purchase_order',$3,$4)`,
        [item.raw_material_id, item.quantity_ordered, id, req.auth!.userId]
      );
      await client.query(
        `UPDATE purchase_order_items SET quantity_received = quantity_ordered WHERE id = $1`,
        [item.id]
      );
    }

    const { rows: countRows } = await client.query(`SELECT COUNT(*)+1 AS seq FROM goods_receipt_notes`);
    await client.query(
      `INSERT INTO goods_receipt_notes (purchase_order_id, grn_number, received_by) VALUES ($1,$2,$3)`,
      [id, `GRN-${String(countRows[0].seq).padStart(5, '0')}`, req.auth!.userId]
    );
    await client.query(`UPDATE purchase_orders SET status = 'received' WHERE id = $1`, [id]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Purchase order received and stock updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
