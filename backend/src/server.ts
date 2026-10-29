import { createApp } from './app';
import { env } from './config/env';
import { pool } from './config/database';
import { logger } from './utils/logger';

async function start() {
  const app = createApp();

  // Verify DB connectivity before accepting traffic
  try {
    await pool.query('SELECT 1');
    logger.info('Database connection established');
  } catch (err) {
    logger.error('Cannot connect to database', err);
    process.exit(1);
  }

  app.listen(env.port, () => {
    logger.info(`Bakery CRM API running on port ${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing DB pool');
  await pool.end();
  process.exit(0);
});
process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing DB pool');
  await pool.end();
  process.exit(0);
});
