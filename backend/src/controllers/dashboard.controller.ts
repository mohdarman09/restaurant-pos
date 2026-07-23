import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';

/** GET /api/dashboard/summary — headline KPI cards */
export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.auth!.restaurantId;

  const { rows } = await pool.query(
    `
    SELECT
      COALESCE(SUM(total_amount) FILTER (WHERE completed_at::date = current_date), 0) AS sales_today,
      COALESCE(SUM(total_amount) FILTER (WHERE completed_at >= date_trunc('week', now())), 0) AS sales_week,
      COALESCE(SUM(total_amount) FILTER (WHERE completed_at >= date_trunc('month', now())), 0) AS sales_month,
      COUNT(*) FILTER (WHERE created_at::date = current_date) AS total_orders_today,
      COUNT(*) FILTER (WHERE status = 'completed' AND created_at::date = current_date) AS completed_orders,
      COUNT(*) FILTER (WHERE status IN ('held','placed','preparing','ready') AND created_at::date = current_date) AS pending_orders,
      COUNT(*) FILTER (WHERE status = 'cancelled' AND created_at::date = current_date) AS cancelled_orders,
      COALESCE(AVG(total_amount) FILTER (WHERE status = 'completed' AND created_at::date = current_date), 0) AS avg_order_value
    FROM orders
    WHERE restaurant_id = $1 AND deleted_at IS NULL
    `,
    [restaurantId]
  );

  const { rows: customerRows } = await pool.query(
    `SELECT COUNT(*) AS total_customers FROM customers WHERE restaurant_id = $1 AND deleted_at IS NULL`,
    [restaurantId]
  );

  const { rows: lowStockRows } = await pool.query(
    `SELECT id, name, current_stock, reorder_level FROM raw_materials
     WHERE restaurant_id = $1 AND deleted_at IS NULL AND current_stock <= reorder_level
     ORDER BY current_stock ASC LIMIT 10`,
    [restaurantId]
  );

  const { rows: bestSellers } = await pool.query(
    `SELECT p.id, p.name, SUM(oi.quantity) AS units_sold, SUM(oi.total_amount) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE o.restaurant_id = $1 AND o.status = 'completed' AND o.deleted_at IS NULL
       AND o.completed_at >= now() - interval '30 days'
     GROUP BY p.id, p.name
     ORDER BY units_sold DESC
     LIMIT 5`,
    [restaurantId]
  );

  res.json({
    success: true,
    data: {
      ...rows[0],
      total_customers: customerRows[0].total_customers,
      low_stock_alerts: lowStockRows,
      best_selling_items: bestSellers,
    },
  });
});

/** GET /api/dashboard/sales-trend?days=14 — for the revenue chart */
export const getSalesTrend = asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.auth!.restaurantId;
  const days = Math.min(90, Math.max(1, parseInt(String(req.query.days ?? '14'), 10) || 14));

  const { rows } = await pool.query(
    `
    SELECT d::date AS date,
           COALESCE(SUM(o.total_amount), 0) AS revenue,
           COUNT(o.id) AS orders
    FROM generate_series(current_date - ($2::int - 1), current_date, interval '1 day') AS d
    LEFT JOIN orders o
      ON o.completed_at::date = d::date
     AND o.restaurant_id = $1
     AND o.status = 'completed'
     AND o.deleted_at IS NULL
    GROUP BY d
    ORDER BY d
    `,
    [restaurantId, days]
  );

  res.json({ success: true, data: rows });
});
