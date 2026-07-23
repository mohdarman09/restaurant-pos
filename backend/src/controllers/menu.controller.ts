import { Request, Response } from 'express';
import { pool } from '../config/db';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { getPagination, paginatedResponse } from '../utils/pagination';

/** GET /api/menu/categories */
export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT id, parent_id, name, image_url, sort_order, is_active
     FROM categories WHERE restaurant_id = $1 AND deleted_at IS NULL
     ORDER BY sort_order, name`,
    [req.auth!.restaurantId]
  );
  res.json({ success: true, data: rows });
});

/** POST /api/menu/categories */
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name, parentId, imageUrl, sortOrder } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO categories (restaurant_id, parent_id, name, image_url, sort_order)
     VALUES ($1, $2, $3, $4, COALESCE($5, 0)) RETURNING *`,
    [req.auth!.restaurantId, parentId ?? null, name, imageUrl ?? null, sortOrder]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

/** GET /api/menu/products?search=&categoryId=&page=&limit= */
export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset } = getPagination(req);
  const { search, categoryId } = req.query;

  const conditions = ['p.restaurant_id = $1', 'p.deleted_at IS NULL'];
  const params: unknown[] = [req.auth!.restaurantId];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`p.name ILIKE $${params.length}`);
  }
  if (categoryId) {
    params.push(categoryId);
    conditions.push(`p.category_id = $${params.length}`);
  }

  const whereClause = conditions.join(' AND ');

  const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM products p WHERE ${whereClause}`, params);
  const total = parseInt(countRows[0].count, 10);

  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.sku, p.barcode, p.description, p.image_url, p.price, p.cost_price,
            p.is_veg, p.is_available, p.category_id, c.name AS category_name, t.rate_percent AS tax_rate
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
     WHERE ${whereClause}
     ORDER BY p.sort_order, p.name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ success: true, ...paginatedResponse(rows, total, { page, limit, offset }) });
});

/** POST /api/menu/products */
export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const b = req.body;
  const { rows } = await pool.query(
    `INSERT INTO products (restaurant_id, category_id, name, sku, barcode, description, image_url,
                            price, cost_price, tax_rate_id, is_veg, is_available)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,0),$10,COALESCE($11,true),COALESCE($12,true))
     RETURNING *`,
    [req.auth!.restaurantId, b.categoryId, b.name, b.sku ?? null, b.barcode ?? null, b.description ?? null,
      b.imageUrl ?? null, b.price, b.costPrice, b.taxRateId ?? null, b.isVeg, b.isAvailable]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

/** PATCH /api/menu/products/:id */
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const fields = req.body as Record<string, unknown>;
  const columnMap: Record<string, string> = {
    categoryId: 'category_id', name: 'name', sku: 'sku', barcode: 'barcode', description: 'description',
    imageUrl: 'image_url', price: 'price', costPrice: 'cost_price', taxRateId: 'tax_rate_id',
    isVeg: 'is_veg', isAvailable: 'is_available',
  };

  const setClauses: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(columnMap)) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      setClauses.push(`${column} = $${params.length}`);
    }
  }
  if (setClauses.length === 0) throw ApiError.badRequest('No fields provided to update');

  params.push(id, req.auth!.restaurantId);
  const { rows } = await pool.query(
    `UPDATE products SET ${setClauses.join(', ')} WHERE id = $${params.length - 1} AND restaurant_id = $${params.length}
     RETURNING *`,
    params
  );
  if (rows.length === 0) throw ApiError.notFound('Product not found');
  res.json({ success: true, data: rows[0] });
});

/** DELETE /api/menu/products/:id (soft delete) */
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rowCount } = await pool.query(
    `UPDATE products SET deleted_at = now() WHERE id = $1 AND restaurant_id = $2 AND deleted_at IS NULL`,
    [id, req.auth!.restaurantId]
  );
  if (rowCount === 0) throw ApiError.notFound('Product not found');
  res.json({ success: true, message: 'Product deleted' });
});

/** GET /api/menu/products/barcode/:code — exact-match lookup for hardware barcode scanners */
export const findProductByBarcode = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.price, p.is_veg, p.is_available, p.category_id, t.rate_percent AS tax_rate
     FROM products p LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
     WHERE p.restaurant_id = $1 AND p.barcode = $2 AND p.deleted_at IS NULL`,
    [req.auth!.restaurantId, req.params.code]
  );
  if (!rows[0]) throw ApiError.notFound('No product matches this barcode');
  res.json({ success: true, data: rows[0] });
});
export const getProductAddons = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rows: groups } = await pool.query(
    `SELECT ag.id, ag.name, ag.min_select, ag.max_select
     FROM product_addon_groups pag
     JOIN addon_groups ag ON ag.id = pag.addon_group_id
     WHERE pag.product_id = $1`,
    [id]
  );
  for (const group of groups) {
    const { rows: options } = await pool.query(
      `SELECT id, name, price FROM addons WHERE addon_group_id = $1 AND is_active = true ORDER BY name`,
      [group.id]
    );
    group.options = options;
  }
  res.json({ success: true, data: groups });
});

/** GET /api/menu/combos — active combo meals with their constituent products */
export const listCombos = asyncHandler(async (req: Request, res: Response) => {
  const { rows: combos } = await pool.query(
    `SELECT id, name, price, image_url FROM combo_meals
     WHERE restaurant_id = $1 AND is_active = true ORDER BY name`,
    [req.auth!.restaurantId]
  );
  for (const combo of combos) {
    const { rows: items } = await pool.query(
      `SELECT cmi.quantity, p.name, p.price AS base_price
       FROM combo_meal_items cmi JOIN products p ON p.id = cmi.product_id
       WHERE cmi.combo_meal_id = $1`,
      [combo.id]
    );
    combo.items = items;
  }
  res.json({ success: true, data: combos });
});

/** POST /api/menu/combos — create a combo meal from existing products */
export const createCombo = asyncHandler(async (req: Request, res: Response) => {
  const { name, price, imageUrl, items } = req.body as {
    name: string; price: number; imageUrl?: string; items: { productId: string; quantity: number }[];
  };

  const { rows: comboRows } = await pool.query(
    `INSERT INTO combo_meals (restaurant_id, name, price, image_url) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.auth!.restaurantId, name, price, imageUrl ?? null]
  );
  const combo = comboRows[0];

  for (const item of items) {
    await pool.query(
      `INSERT INTO combo_meal_items (combo_meal_id, product_id, quantity) VALUES ($1,$2,$3)`,
      [combo.id, item.productId, item.quantity]
    );
  }

  res.status(201).json({ success: true, data: combo });
});
