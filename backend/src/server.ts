import { createServer } from 'http';
import { app } from './app';
import { env } from './config/env';
import { pool } from './config/db';
import { initRealtime } from './realtime/socket';

async function start() {
  try {
    await pool.query('SELECT 1'); // fail fast if DB is unreachable
    // eslint-disable-next-line no-console
    console.log('[db] Connected to PostgreSQL');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] Failed to connect to PostgreSQL. Is DATABASE_URL correct and is Postgres running?', err);
    process.exit(1);
  }

  const httpServer = createServer(app);
  initRealtime(httpServer);

  httpServer.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Restaurant POS API (+ WebSocket) listening on http://localhost:${env.port}`);
  });
}

start();
