import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { pool } from '../config/db';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { env } from '../config/env';

function buildReceiptText(order: Record<string, unknown>, items: Record<string, unknown>[], restaurantName: string): string {
  const lines = [
    `${restaurantName}`,
    `Order ${order.order_number}`,
    '-------------------------',
    ...items.map((i) => `${i.quantity} x ${i.product_name} — Rs ${Number(i.total_amount).toFixed(0)}`),
    '-------------------------',
    `Subtotal: Rs ${Number(order.subtotal).toFixed(0)}`,
    `Tax: Rs ${Number(order.tax_amount).toFixed(0)}`,
    `Discount: Rs ${Number(order.discount_amount).toFixed(0)}`,
    `Total: Rs ${Number(order.total_amount).toFixed(0)}`,
    '',
    'Thank you for dining with us!',
  ];
  return lines.join('\n');
}

async function loadOrderForReceipt(orderId: string, restaurantId: string) {
  const { rows: orderRows } = await pool.query(
    `SELECT o.*, r.name AS restaurant_name FROM orders o
     JOIN restaurants r ON r.id = o.restaurant_id
     WHERE o.id = $1 AND o.restaurant_id = $2`,
    [orderId, restaurantId]
  );
  const order = orderRows[0];
  if (!order) throw ApiError.notFound('Order not found');

  const { rows: items } = await pool.query(
    `SELECT oi.quantity, oi.total_amount, p.name AS product_name
     FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`,
    [orderId]
  );
  return { order, items };
}

/** POST /api/orders/:id/receipt/email — { email } sends the receipt via SMTP (if configured) */
export const emailReceipt = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email } = req.body as { email: string };
  const { order, items } = await loadOrderForReceipt(id, req.auth!.restaurantId);

  if (!env.smtp.host) {
    throw ApiError.badRequest(
      'Email delivery is not configured. Set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM in the backend .env file.'
    );
  }

  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });

  await transporter.sendMail({
    from: env.smtp.from || env.smtp.user,
    to: email,
    subject: `Your receipt from ${order.restaurant_name} — Order ${order.order_number}`,
    text: buildReceiptText(order, items, order.restaurant_name),
  });

  await pool.query(
    `INSERT INTO receipts (order_id, channel, sent_to) VALUES ($1,'email',$2)`,
    [id, email]
  );

  res.json({ success: true, message: `Receipt emailed to ${email}` });
});

/** POST /api/orders/:id/receipt/whatsapp — { phone } returns a pre-filled wa.me share link
 *  (no paid WhatsApp Business API key required; opens the customer's own WhatsApp to send it). */
export const whatsappReceiptLink = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { phone } = req.body as { phone: string };
  const { order, items } = await loadOrderForReceipt(id, req.auth!.restaurantId);

  const text = buildReceiptText(order, items, order.restaurant_name);
  const digitsOnly = phone.replace(/[^\d]/g, '');
  const waLink = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(text)}`;

  await pool.query(
    `INSERT INTO receipts (order_id, channel, sent_to) VALUES ($1,'whatsapp',$2)`,
    [id, phone]
  );

  res.json({ success: true, data: { link: waLink } });
});

/** GET /api/orders/:id/receipt/text — plain-text receipt, used by the Print button */
export const receiptText = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { order, items } = await loadOrderForReceipt(id, req.auth!.restaurantId);
  res.json({ success: true, data: { text: buildReceiptText(order, items, order.restaurant_name) } });
});
