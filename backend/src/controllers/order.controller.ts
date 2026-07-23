import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { pool, withTransaction } from '../config/db';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { getPagination, paginatedResponse } from '../utils/pagination';
import { emitKdsUpdate, emitTablesUpdate } from '../realtime/socket';

interface IncomingItem {
  productId?: string;
  comboMealId?: string;
  variantId?: string | null;
  quantity: number;
  addonIds?: string[];
  notes?: string;
}

/** Inserts order_items (+ addons) for the given items and returns their total value added.
 *  Combo meals are expanded into their constituent products, with the combo's flat price
 *  apportioned across the lines pro-rata by each constituent's own base price so the
 *  lines sum to (combo price × quantity) while still tracking inventory per product. */
async function insertOrderItems(client: PoolClient, orderId: string, items: IncomingItem[]): Promise<void> {
  for (const item of items) {
    if (item.comboMealId) {
      await insertComboItem(client, orderId, item);
      continue;
    }
    await insertSingleProductItem(client, orderId, item);
  }
}

async function insertComboItem(client: PoolClient, orderId: string, item: IncomingItem): Promise<void> {
  const { rows: comboRows } = await client.query(
    `SELECT price FROM combo_meals WHERE id = $1 AND is_active = true`,
    [item.comboMealId]
  );
  const combo = comboRows[0];
  if (!combo) throw ApiError.badRequest(`Combo meal not found: ${item.comboMealId}`);

  const { rows: comboItems } = await client.query(
    `SELECT cmi.product_id, cmi.quantity, p.price AS base_price, t.rate_percent AS tax_rate
     FROM combo_meal_items cmi
     JOIN products p ON p.id = cmi.product_id
     LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
     WHERE cmi.combo_meal_id = $1`,
    [item.comboMealId]
  );
  if (comboItems.length === 0) throw ApiError.badRequest('Combo meal has no configured items');

  const sumOfBasePrices = comboItems.reduce((sum, ci) => sum + Number(ci.base_price) * Number(ci.quantity), 0) || 1;
  const comboPrice = Number(combo.price) * item.quantity;

  for (const ci of comboItems) {
    const lineShare = ((Number(ci.base_price) * Number(ci.quantity)) / sumOfBasePrices) * comboPrice;
    const taxRate = Number(ci.tax_rate ?? 0);
    const taxAmount = Math.round(((lineShare * taxRate) / 100) * 100) / 100;
    const totalAmount = Math.round((lineShare + taxAmount) * 100) / 100;
    const effectiveQty = Number(ci.quantity) * item.quantity;

    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, tax_amount, total_amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [orderId, ci.product_id, effectiveQty, lineShare / effectiveQty, taxAmount, totalAmount,
        item.notes ? `${item.notes} (combo)` : 'part of combo']
    );
  }
}

async function insertSingleProductItem(client: PoolClient, orderId: string, item: IncomingItem): Promise<void> {
    if (!item.productId) throw ApiError.badRequest('Each order item needs a productId or a comboMealId');
    const { rows: productRows } = await client.query(
      `SELECT p.price, p.track_inventory, t.rate_percent AS tax_rate
       FROM products p LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [item.productId]
    );
    const product = productRows[0];
    if (!product) throw ApiError.badRequest(`Product not found: ${item.productId}`);

    let unitPrice = Number(product.price);
    if (item.variantId) {
      const { rows: variantRows } = await client.query(
        `SELECT price_delta FROM product_variants WHERE id = $1 AND product_id = $2`,
        [item.variantId, item.productId]
      );
      if (variantRows[0]) unitPrice += Number(variantRows[0].price_delta);
    }

    let addonTotal = 0;
    const resolvedAddons: { id: string; price: number }[] = [];
    if (item.addonIds?.length) {
      const { rows: addonRows } = await client.query(
        `SELECT id, price FROM addons WHERE id = ANY($1::uuid[])`,
        [item.addonIds]
      );
      for (const a of addonRows) {
        addonTotal += Number(a.price);
        resolvedAddons.push({ id: a.id, price: Number(a.price) });
      }
    }

    const lineBase = (unitPrice + addonTotal) * item.quantity;
    const taxRate = Number(product.tax_rate ?? 0);
    const taxAmount = Math.round(((lineBase * taxRate) / 100) * 100) / 100;
    const totalAmount = Math.round((lineBase + taxAmount) * 100) / 100;

    const { rows: itemRows } = await client.query(
      `INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price, tax_amount, total_amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [orderId, item.productId, item.variantId ?? null, item.quantity, unitPrice, taxAmount, totalAmount, item.notes ?? null]
    );
    const orderItemId = itemRows[0].id;

    for (const addon of resolvedAddons) {
      await client.query(
        `INSERT INTO order_item_addons (order_item_id, addon_id, price) VALUES ($1,$2,$3)`,
        [orderItemId, addon.id, addon.price]
      );
    }
}

/** Recomputes subtotal/tax/total from order_items + current discount/service-charge fields. */
async function recalcOrderTotals(client: PoolClient, orderId: string): Promise<void> {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(unit_price * quantity),0) AS subtotal, COALESCE(SUM(tax_amount),0) AS tax_amount
     FROM order_items WHERE order_id = $1`,
    [orderId]
  );
  const subtotal = Number(rows[0].subtotal);
  const itemTax = Number(rows[0].tax_amount);

  const { rows: orderRows } = await client.query(
    `SELECT discount_percent, discount_amount, service_charge_amount FROM orders WHERE id = $1`,
    [orderId]
  );
  const o = orderRows[0];
  const discountFromPercent = (subtotal * Number(o.discount_percent)) / 100;
  const totalDiscount = Math.max(Number(o.discount_amount), discountFromPercent);
  const total = subtotal - totalDiscount + itemTax + Number(o.service_charge_amount);
  const roundedTotal = Math.round(total);
  const roundOff = Math.round((roundedTotal - total) * 100) / 100;

  await client.query(
    `UPDATE orders SET subtotal = $1, tax_amount = $2, discount_amount = $3, total_amount = $4, round_off = $5
     WHERE id = $6`,
    [subtotal, itemTax, totalDiscount, roundedTotal, roundOff, orderId]
  );
}

async function nextOrderNumber(client: PoolClient, outletId: string): Promise<string> {
  const { rows } = await client.query(
    `SELECT COUNT(*) + 1 AS seq FROM orders WHERE outlet_id = $1 AND created_at::date = current_date`,
    [outletId]
  );
  const seq = String(rows[0].seq).padStart(4, '0');
  return `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${seq}`;
}

/** POST /api/orders — create a new POS order (dine-in / take-away / delivery), status = held */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { orderType, tableId, customerId, waiterId, items } = req.body;
  const auth = req.auth!;

  const order = await withTransaction(async (client) => {
    const outletId = auth.outletId;
    if (!outletId) throw ApiError.badRequest('User has no outlet assigned');

    const orderNumber = await nextOrderNumber(client, outletId);
    const { rows } = await client.query(
      `INSERT INTO orders (restaurant_id, outlet_id, order_number, order_type, table_id, customer_id,
                            waiter_id, cashier_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'held') RETURNING *`,
      [auth.restaurantId, outletId, orderNumber, orderType, tableId ?? null, customerId ?? null,
        waiterId ?? null, auth.userId]
    );
    const newOrder = rows[0];

    await insertOrderItems(client, newOrder.id, items);
    await recalcOrderTotals(client, newOrder.id);

    if (tableId) {
      await client.query(`UPDATE dining_tables SET status = 'occupied' WHERE id = $1`, [tableId]);
    }

    const { rows: finalRows } = await client.query(`SELECT * FROM orders WHERE id = $1`, [newOrder.id]);
    return finalRows[0];
  }, auth.userId);

  if (auth.outletId) {
    emitTablesUpdate(auth.outletId);
    emitKdsUpdate(auth.outletId);
  }
  res.status(201).json({ success: true, data: order });
});

/** POST /api/orders/:id/items — add more items to a held/placed order */
export const addItems = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { items } = req.body;

  const order = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2 AND status NOT IN ('completed','cancelled')`,
      [id, req.auth!.restaurantId]
    );
    if (!rows[0]) throw ApiError.notFound('Order not found or already closed');

    await insertOrderItems(client, id, items);
    await recalcOrderTotals(client, id);

    const { rows: finalRows } = await client.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return finalRows[0];
  }, req.auth!.userId);

  if (req.auth!.outletId) emitKdsUpdate(req.auth!.outletId);
  res.json({ success: true, data: order });
});

/** PATCH /api/orders/:id/discount — apply % / flat / coupon discount */
export const applyDiscount = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { discountPercent, discountAmount, couponCode } = req.body;

  const order = await withTransaction(async (client) => {
    let couponId: string | null = null;
    let percent = discountPercent ?? 0;
    let amount = discountAmount ?? 0;

    if (couponCode) {
      const { rows: couponRows } = await client.query(
        `SELECT * FROM coupons WHERE restaurant_id = $1 AND code = $2 AND is_active = true
         AND (valid_until IS NULL OR valid_until > now())`,
        [req.auth!.restaurantId, couponCode]
      );
      const coupon = couponRows[0];
      if (!coupon) throw ApiError.badRequest('Invalid or expired coupon code');
      if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        throw ApiError.badRequest('Coupon usage limit reached');
      }
      couponId = coupon.id;
      if (coupon.discount_type === 'percent') {
        percent = Number(coupon.discount_value);
      } else {
        amount = Number(coupon.discount_value);
      }
      await client.query(`UPDATE coupons SET used_count = used_count + 1 WHERE id = $1`, [couponId]);
    }

    await client.query(
      `UPDATE orders SET discount_percent = $1, discount_amount = $2, coupon_id = $3 WHERE id = $4`,
      [percent, amount, couponId, id]
    );
    await recalcOrderTotals(client, id);

    const { rows } = await client.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return rows[0];
  }, req.auth!.userId);

  res.json({ success: true, data: order });
});

/** POST /api/orders/:id/checkout — take payment(s) and complete the order */
export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { payments, serviceChargeId } = req.body;

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2 AND status NOT IN ('completed','cancelled')
       FOR UPDATE`,
      [id, req.auth!.restaurantId]
    );
    const order = rows[0];
    if (!order) throw ApiError.notFound('Order not found or already closed');

    if (serviceChargeId) {
      const { rows: scRows } = await client.query(`SELECT rate_percent FROM service_charges WHERE id = $1`, [serviceChargeId]);
      if (scRows[0]) {
        const serviceChargeAmount = (Number(order.subtotal) * Number(scRows[0].rate_percent)) / 100;
        await client.query(`UPDATE orders SET service_charge_amount = $1 WHERE id = $2`, [serviceChargeAmount, id]);
        await recalcOrderTotals(client, id);
      }
    }

    const { rows: refreshedRows } = await client.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const refreshed = refreshedRows[0];

    const paidTotal = payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
    if (paidTotal < Number(refreshed.total_amount) - 0.5) {
      throw ApiError.badRequest(
        `Payment total (${paidTotal}) is less than order total (${refreshed.total_amount})`
      );
    }

    for (const p of payments) {
      await client.query(
        `INSERT INTO order_payments (order_id, method, amount, reference_no) VALUES ($1,$2,$3,$4)`,
        [id, p.method, p.amount, p.referenceNo ?? null]
      );
    }

    await client.query(
      `UPDATE orders SET status = 'completed', placed_at = COALESCE(placed_at, now()), completed_at = now()
       WHERE id = $1`,
      [id]
    );

    // Auto stock deduction for tracked-inventory products via their recipe (BOM)
    const { rows: itemRows } = await client.query(
      `SELECT oi.quantity, oi.product_id FROM order_items oi WHERE oi.order_id = $1`,
      [id]
    );
    for (const item of itemRows) {
      const { rows: recipeRows } = await client.query(
        `SELECT raw_material_id, quantity_required FROM product_recipes WHERE product_id = $1`,
        [item.product_id]
      );
      for (const recipe of recipeRows) {
        const deduction = Number(recipe.quantity_required) * Number(item.quantity);
        await client.query(
          `UPDATE raw_materials SET current_stock = current_stock - $1 WHERE id = $2`,
          [deduction, recipe.raw_material_id]
        );
        await client.query(
          `INSERT INTO stock_movements (raw_material_id, movement_type, quantity, reference_type, reference_id, created_by)
           VALUES ($1,'sale_deduction',$2,'order',$3,$4)`,
          [recipe.raw_material_id, deduction, id, req.auth!.userId]
        );
      }
    }

    if (refreshed.table_id) {
      await client.query(`UPDATE dining_tables SET status = 'cleaning' WHERE id = $1`, [refreshed.table_id]);
    }

    const { rows: finalRows } = await client.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return finalRows[0];
  }, req.auth!.userId);

  if (req.auth!.outletId) {
    emitTablesUpdate(req.auth!.outletId);
    emitKdsUpdate(req.auth!.outletId);
  }
  res.json({ success: true, data: result });
});

/** PATCH /api/orders/:id/cancel */
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const { rows } = await pool.query(
    `UPDATE orders SET status = 'cancelled', cancel_reason = $1 WHERE id = $2 AND restaurant_id = $3
     AND status NOT IN ('completed','cancelled') RETURNING *`,
    [reason ?? null, id, req.auth!.restaurantId]
  );
  if (rows.length === 0) throw ApiError.notFound('Order not found or already closed');
  res.json({ success: true, data: rows[0] });
});

/** GET /api/orders?status=&orderType=&page=&limit= */
export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset } = getPagination(req);
  const { status, orderType } = req.query;

  const conditions = ['o.restaurant_id = $1', 'o.deleted_at IS NULL'];
  const params: unknown[] = [req.auth!.restaurantId];
  if (status) { params.push(status); conditions.push(`o.status = $${params.length}`); }
  if (orderType) { params.push(orderType); conditions.push(`o.order_type = $${params.length}`); }
  const whereClause = conditions.join(' AND ');

  const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM orders o WHERE ${whereClause}`, params);
  const total = parseInt(countRows[0].count, 10);

  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT o.*, t.name AS table_name, c.full_name AS customer_name
     FROM orders o
     LEFT JOIN dining_tables t ON t.id = o.table_id
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE ${whereClause}
     ORDER BY o.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ success: true, ...paginatedResponse(rows, total, { page, limit, offset }) });
});

/** GET /api/orders/:id */
export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rows: orderRows } = await pool.query(
    `SELECT o.*, t.name AS table_name FROM orders o LEFT JOIN dining_tables t ON t.id = o.table_id
     WHERE o.id = $1 AND o.restaurant_id = $2`,
    [id, req.auth!.restaurantId]
  );
  if (!orderRows[0]) throw ApiError.notFound('Order not found');

  const { rows: itemRows } = await pool.query(
    `SELECT oi.*, p.name AS product_name FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1 ORDER BY oi.created_at`,
    [id]
  );
  const { rows: paymentRows } = await pool.query(`SELECT * FROM order_payments WHERE order_id = $1`, [id]);
  const { rows: splitRows } = await pool.query(`SELECT * FROM order_splits WHERE order_id = $1 ORDER BY created_at`, [id]);

  res.json({ success: true, data: { ...orderRows[0], items: itemRows, payments: paymentRows, splits: splitRows } });
});

/** POST /api/orders/:id/splits — divide the bill into N guest allocations (e.g. "Guest 1", "Guest 2") */
export const createSplits = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { splits } = req.body as { splits: { label: string; amount: number }[] };

  const result = await withTransaction(async (client) => {
    const { rows: orderRows } = await client.query(
      `SELECT total_amount FROM orders WHERE id = $1 AND restaurant_id = $2 AND status NOT IN ('completed','cancelled')`,
      [id, req.auth!.restaurantId]
    );
    if (!orderRows[0]) throw ApiError.notFound('Order not found or already closed');

    const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(splitTotal - Number(orderRows[0].total_amount)) > 1) {
      throw ApiError.badRequest(
        `Split amounts (${splitTotal}) must add up to the order total (${orderRows[0].total_amount})`
      );
    }

    await client.query(`DELETE FROM order_splits WHERE order_id = $1`, [id]);
    for (const split of splits) {
      await client.query(
        `INSERT INTO order_splits (order_id, split_label, amount) VALUES ($1,$2,$3)`,
        [id, split.label, split.amount]
      );
    }
    const { rows } = await client.query(`SELECT * FROM order_splits WHERE order_id = $1 ORDER BY created_at`, [id]);
    return rows;
  }, req.auth!.userId);

  res.status(201).json({ success: true, data: result });
});

/** PATCH /api/orders/:id/splits/:splitId/pay — settle one guest's share; completes the order once all are paid */
export const paySplit = asyncHandler(async (req: Request, res: Response) => {
  const { id, splitId } = req.params;
  const { method, referenceNo } = req.body;

  const result = await withTransaction(async (client) => {
    const { rows: splitRows } = await client.query(
      `SELECT * FROM order_splits WHERE id = $1 AND order_id = $2 FOR UPDATE`,
      [splitId, id]
    );
    const split = splitRows[0];
    if (!split) throw ApiError.notFound('Split not found');
    if (split.is_paid) throw ApiError.badRequest('This split is already paid');

    await client.query(
      `INSERT INTO order_payments (order_id, method, amount, reference_no) VALUES ($1,$2,$3,$4)`,
      [id, method, split.amount, referenceNo ?? null]
    );
    await client.query(`UPDATE order_splits SET is_paid = true WHERE id = $1`, [splitId]);

    const { rows: remaining } = await client.query(
      `SELECT COUNT(*) FROM order_splits WHERE order_id = $1 AND is_paid = false`,
      [id]
    );
    let orderCompleted = false;
    if (parseInt(remaining[0].count, 10) === 0) {
      await client.query(
        `UPDATE orders SET status = 'completed', placed_at = COALESCE(placed_at, now()), completed_at = now()
         WHERE id = $1 AND status NOT IN ('completed','cancelled')`,
        [id]
      );
      orderCompleted = true;
    }

    const { rows: allSplits } = await client.query(`SELECT * FROM order_splits WHERE order_id = $1 ORDER BY created_at`, [id]);
    return { splits: allSplits, orderCompleted };
  }, req.auth!.userId);

  res.json({ success: true, data: result });
});
