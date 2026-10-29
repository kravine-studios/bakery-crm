import { Pool, PoolConfig } from 'pg';
import { env } from './env';

const poolConfig: PoolConfig = {
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  min: env.db.poolMin,
  max: env.db.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error on idle pg client', err);
  process.exit(-1);
});

/**
 * Run a callback inside a transaction.
 * Automatically BEGIN, COMMIT on success, ROLLBACK on error.
 */
export async function withTransaction<T>(work: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute a query with the shared pool.
 */
export function query<T extends import('pg').QueryResultRow = import('pg').QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return pool.query<T>(text, params);
}
