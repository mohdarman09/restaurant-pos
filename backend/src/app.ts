import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import menuRoutes from './routes/menu.routes';
import orderRoutes from './routes/order.routes';
import tableRoutes from './routes/table.routes';
import kdsRoutes from './routes/kds.routes';
import inventoryRoutes from './routes/inventory.routes';
import reportRoutes from './routes/report.routes';
import customerRoutes from './routes/customer.routes';
import settingsRoutes from './routes/settings.routes';
import expenseRoutes from './routes/expense.routes';
import employeeRoutes from './routes/employee.routes';
import notificationRoutes from './routes/notification.routes';

export const app = express();

app.use(helmet());

import cors from 'cors';

// `.env` se comma separated origins padho aur trim kar do
const origins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Postman ya direct server-to-server calls ke liye (no origin)
      if (!origin) return callback(null, true);

      if (origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

// Global API rate limit (auth endpoints have their own, stricter limit)
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ status: 'ok', env: env.nodeEnv }));

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/kds', kdsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
