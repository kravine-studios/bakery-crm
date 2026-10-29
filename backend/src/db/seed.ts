import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { env } from '../config/env';
import { Role } from '../types/enums';
import { logger } from '../utils/logger';

/**
 * Seed the database with the initial admin user and default settings.
 * Run with: npm run seed
 *
 * The first user created becomes the admin (per PRD rule 3).
 */
async function seed() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Shop Owner';

  const existing = await pool.query<{ id: number }>(
    'SELECT id FROM users WHERE username = $1',
    [adminUsername]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    logger.info(`Seed admin "${adminUsername}" already exists, skipping`);
    return;
  }

  const hash = await bcrypt.hash(adminPassword, env.bcryptRounds);

  await pool.query(
    `INSERT INTO users (username, password_hash, role, display_name, is_active, created_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW())`,
    [adminUsername, hash, Role.Admin, adminName]
  );

  // Default shop settings (upsert)
  await pool.query(`
    INSERT INTO settings (shop_name, address, phone, gstin, fssai_number, invoice_prefix, invoice_footer, tax_inclusive, currency)
    VALUES ('My Bakery', '', '', '', '', 'INV', 'Thank you! Visit again.', FALSE, 'INR')
    ON CONFLICT (id) DO NOTHING
  `);

  // Default categories from PRD 5.2
  const categories = ['Sweets', 'Dates', 'Chocolates', 'Bakery Items', 'Cakes', 'Cold Drinks', 'Snacks', 'Packaged Goods'];
  for (const name of categories) {
    await pool.query(
      `INSERT INTO categories (name, is_active, created_at)
       VALUES ($1, TRUE, NOW())
       ON CONFLICT (name) DO NOTHING`,
      [name]
    );
  }

  logger.info(`Seed complete. Admin user "${adminUsername}" created.`);
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Seed failed', err);
    process.exit(1);
  });
