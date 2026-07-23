import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { sendCsv } from '../utils/csv';
import { streamPdfReport } from '../utils/pdfReport';

async function getRestaurantName(restaurantId: string): Promise<string> {
  const { rows } = await pool.query(`SELECT name FROM restaurants WHERE id = $1`, [restaurantId]);
  return rows[0]?.name ?? 'Restaurant POS';
}

function dateRange(req: Request): { from: string; to: string } {
  const from = String(req.query.from ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const to = String(req.query.to ?? new Date().toISOString().slice(0, 10));
  return { from, to };
}

/** GET /api/reports/sales?from=&to=&groupBy=day|week|month */
export const salesReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = dateRange(req);
  const groupBy = (req.query.groupBy as string) === 'month' ? 'month' : (req.query.groupBy as string) === 'week' ? 'week' : 'day';

  const { rows } = await pool.query(
    `SELECT date_trunc($1, completed_at) AS period,
            COUNT(*) AS orders, SUM(total_amount) AS revenue, SUM(tax_amount) AS tax,
            SUM(discount_amount) AS discounts
     FROM orders
     WHERE restaurant_id = $2 AND status = 'completed' AND deleted_at IS NULL
       AND completed_at::date BETWEEN $3 AND $4
     GROUP BY period ORDER BY period`,
    [groupBy, req.auth!.restaurantId, from, to]
  );
  if (req.query.format === 'csv') {
    sendCsv(res, 'sales-report.csv', rows);
    return;
  }
  if (req.query.format === 'pdf') {
    streamPdfReport(res, 'sales-report.pdf', {
      title: 'Sales Report',
      subtitle: `${from} to ${to} (grouped by ${groupBy})`,
      restaurantName: await getRestaurantName(req.auth!.restaurantId),
      columns: [
        { header: 'Period', key: 'period', width: 140 },
        { header: 'Orders', key: 'orders', width: 90, align: 'right' },
        { header: 'Revenue', key: 'revenue', width: 120, align: 'right' },
        { header: 'Tax', key: 'tax', width: 100, align: 'right' },
        { header: 'Discounts', key: 'discounts', width: 105, align: 'right' },
      ],
      rows: rows.map((r) => ({
        period: new Date(r.period).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        orders: r.orders,
        revenue: `Rs ${Number(r.revenue).toFixed(0)}`,
        tax: `Rs ${Number(r.tax).toFixed(0)}`,
        discounts: `Rs ${Number(r.discounts).toFixed(0)}`,
      })),
    });
    return;
  }
  res.json({ success: true, data: rows });
});

/** GET /api/reports/orders?from=&to=&status= */
export const orderReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = dateRange(req);
  const { rows } = await pool.query(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS total
     FROM orders WHERE restaurant_id = $1 AND deleted_at IS NULL AND created_at::date BETWEEN $2 AND $3
     GROUP BY status`,
    [req.auth!.restaurantId, from, to]
  );
  res.json({ success: true, data: rows });
});

/** GET /api/reports/products?from=&to=&type=best|slow */
export const productReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = dateRange(req);
  const type = req.query.type === 'slow' ? 'ASC' : 'DESC';

  const { rows } = await pool.query(
    `SELECT p.id, p.name, c.name AS category, SUM(oi.quantity) AS units_sold, SUM(oi.total_amount) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE o.restaurant_id = $1 AND o.status = 'completed' AND o.completed_at::date BETWEEN $2 AND $3
     GROUP BY p.id, p.name, c.name
     ORDER BY units_sold ${type}
     LIMIT 20`,
    [req.auth!.restaurantId, from, to]
  );
  if (req.query.format === 'csv') {
    sendCsv(res, 'product-report.csv', rows);
    return;
  }
  res.json({ success: true, data: rows });
});

/** GET /api/reports/inventory — current stock + wastage summary */
export const inventoryReport = asyncHandler(async (req: Request, res: Response) => {
  const { rows: stockRows } = await pool.query(
    `SELECT rm.name, rm.current_stock, rm.reorder_level, u.abbreviation AS unit
     FROM raw_materials rm JOIN units u ON u.id = rm.unit_id
     WHERE rm.restaurant_id = $1 AND rm.deleted_at IS NULL ORDER BY rm.name`,
    [req.auth!.restaurantId]
  );
  const { from, to } = dateRange(req);
  const { rows: wastageRows } = await pool.query(
    `SELECT rm.name, SUM(sm.quantity) AS wasted_quantity, u.abbreviation AS unit
     FROM stock_movements sm
     JOIN raw_materials rm ON rm.id = sm.raw_material_id
     JOIN units u ON u.id = rm.unit_id
     WHERE rm.restaurant_id = $1 AND sm.movement_type = 'wastage' AND sm.created_at::date BETWEEN $2 AND $3
     GROUP BY rm.name, u.abbreviation ORDER BY wasted_quantity DESC`,
    [req.auth!.restaurantId, from, to]
  );
  res.json({ success: true, data: { currentStock: stockRows, wastage: wastageRows } });
});

/** GET /api/reports/financial?from=&to= — revenue, tax, expenses, P&L, payment method split */
export const financialReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = dateRange(req);
  const restaurantId = req.auth!.restaurantId;

  const { rows: revenueRows } = await pool.query(
    `SELECT COALESCE(SUM(total_amount),0) AS revenue, COALESCE(SUM(tax_amount),0) AS tax
     FROM orders WHERE restaurant_id = $1 AND status = 'completed' AND completed_at::date BETWEEN $2 AND $3`,
    [restaurantId, from, to]
  );
  const { rows: expenseRows } = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total_expenses FROM expenses
     WHERE restaurant_id = $1 AND spent_at BETWEEN $2 AND $3`,
    [restaurantId, from, to]
  );
  const { rows: paymentRows } = await pool.query(
    `SELECT op.method, SUM(op.amount) AS total FROM order_payments op
     JOIN orders o ON o.id = op.order_id
     WHERE o.restaurant_id = $1 AND o.completed_at::date BETWEEN $2 AND $3
     GROUP BY op.method`,
    [restaurantId, from, to]
  );

  const revenue = Number(revenueRows[0].revenue);
  const totalExpenses = Number(expenseRows[0].total_expenses);

  if (req.query.format === 'csv') {
    sendCsv(res, 'financial-report.csv', [
      { metric: 'Revenue', value: revenue },
      { metric: 'Tax', value: Number(revenueRows[0].tax) },
      { metric: 'Total Expenses', value: totalExpenses },
      { metric: 'Gross Profit', value: revenue - totalExpenses },
      ...paymentRows.map((p) => ({ metric: `Payments — ${p.method}`, value: p.total })),
    ]);
    return;
  }

  if (req.query.format === 'pdf') {
    streamPdfReport(res, 'financial-report.pdf', {
      title: 'Financial Summary',
      subtitle: `${from} to ${to}`,
      restaurantName: await getRestaurantName(restaurantId),
      summaryLines: [
        { label: 'Revenue', value: `Rs ${revenue.toFixed(0)}` },
        { label: 'Tax collected', value: `Rs ${Number(revenueRows[0].tax).toFixed(0)}` },
        { label: 'Total expenses', value: `Rs ${totalExpenses.toFixed(0)}` },
        { label: 'Gross profit', value: `Rs ${(revenue - totalExpenses).toFixed(0)}` },
      ],
      columns: [
        { header: 'Payment Method', key: 'method', width: 250 },
        { header: 'Total', key: 'total', width: 200, align: 'right' },
      ],
      rows: paymentRows.map((p) => ({ method: p.method, total: `Rs ${Number(p.total).toFixed(0)}` })),
    });
    return;
  }

  res.json({
    success: true,
    data: {
      revenue,
      tax: Number(revenueRows[0].tax),
      totalExpenses,
      grossProfit: revenue - totalExpenses,
      paymentMethodBreakdown: paymentRows,
    },
  });
});

/** GET /api/reports/customers — top customers + retention proxy */
export const customerReport = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.full_name, c.phone, COUNT(o.id) AS order_count, COALESCE(SUM(o.total_amount),0) AS lifetime_value
     FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'completed'
     WHERE c.restaurant_id = $1 AND c.deleted_at IS NULL
     GROUP BY c.id ORDER BY lifetime_value DESC LIMIT 20`,
    [req.auth!.restaurantId]
  );
  res.json({ success: true, data: rows });
});

/** GET /api/reports/employees — sales by employee (cashier), attendance summary */
export const employeeReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = dateRange(req);
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, COUNT(o.id) AS orders_handled, COALESCE(SUM(o.total_amount),0) AS revenue_generated
     FROM users u LEFT JOIN orders o ON o.cashier_id = u.id AND o.status = 'completed'
       AND o.completed_at::date BETWEEN $2 AND $3
     WHERE u.restaurant_id = $1 AND u.deleted_at IS NULL
     GROUP BY u.id ORDER BY revenue_generated DESC`,
    [req.auth!.restaurantId, from, to]
  );
  res.json({ success: true, data: rows });
});
