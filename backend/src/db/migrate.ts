import fs from 'fs';
import path from 'path';
import { pool, withTransaction } from '../config/database';
import { logger } from '../utils/logger';

const MIGRATIONS_DIR = __dirname + '/migrations';

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(): Promise<string[]> {
  const result = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename ASC'
  );
  return result.rows.map((r) => r.filename);
}

async function runMigration(direction: 'up' | 'down' = 'up') {
  await ensureMigrationsTable();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    logger.info('No migration files found');
    return;
  }

  const applied = await getAppliedMigrations();

  if (direction === 'up') {
    for (const file of files) {
      if (applied.includes(file)) continue;
      logger.info(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

      await withTransaction(async (client) => {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      });

      logger.info(`Applied: ${file}`);
    }
  } else {
    // rollback last applied migration if it has a corresponding .down.sql
    // (simplified: rolls back by deleting the record only)
    const last = applied[applied.length - 1];
    if (!last) {
      logger.info('Nothing to roll back');
      return;
    }
    await pool.query('DELETE FROM schema_migrations WHERE filename = $1', [last]);
    logger.warn(`Rolled back record for ${last} (manual SQL rollback may be needed)`);
  }
}

runMigration(process.argv[2] as 'up' | 'down' ?? 'up')
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Migration failed', err);
    process.exit(1);
  });
