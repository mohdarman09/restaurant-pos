import { Pool, PoolClient } from 'pg';

if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('[db] DATABASE_URL is not set — falling back to default local connection string');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/restaurant_pos',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err: Error) => {
  // eslint-disable-next-line no-console
  console.error('[db] Unexpected error on idle client', err);
});

/**
 * Run a callback inside a transaction. Also sets app.current_user_id for the
 * session so the audit_logs trigger can attribute changes to the acting user.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  actingUserId?: string
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (actingUserId) {
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', actingUserId]);
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}
