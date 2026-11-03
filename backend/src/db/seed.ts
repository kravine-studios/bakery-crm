/**
 * Bakery CRM — Database Seed
 *
 * Creates exactly 5 user accounts (1 admin, 1 manager, 3 cashiers)
 * each with a unique, cryptographically generated strong password.
 *
 * Passwords are:
 *   - Printed ONCE to the terminal
 *   - Written to DEMO_CREDENTIALS.local.md (gitignored — never committed)
 *
 * NEVER stored in plaintext. Only bcrypt hashes go into the database.
 *
 * Run with:  npm run seed
 * Run migrations first:  npm run migrate
 */

import fs   from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { env }  from '../config/env';
import { Role } from '../types/enums';
import { logger } from '../utils/logger';
import { generateStrongPassword } from '../utils/passwordPolicy';

interface SeedUser {
  username:    string;
  displayName: string;
  role:        Role;
  password?:   string;  // set at runtime; never read from config
}

/** The five canonical accounts. Passwords are generated fresh each run. */
const SEED_USERS: SeedUser[] = [
  { username: 'admin',    displayName: 'Shop Owner',    role: Role.Admin   },
  { username: 'manager1', displayName: 'Sunita Sharma', role: Role.Manager },
  { username: 'cashier1', displayName: 'Amit Cashier',  role: Role.Cashier },
  { username: 'cashier2', displayName: 'Priya Cashier', role: Role.Cashier },
  { username: 'cashier3', displayName: 'Rohan Cashier', role: Role.Cashier },
];

async function seed() {
  // ── Assign fresh passwords ─────────────────────────────────────
  // Each account gets a different password. We generate them upfront
  // so we can write the credentials file before any DB work.
  const passwords: Record<string, string> = {};
  for (const u of SEED_USERS) {
    passwords[u.username] = generateStrongPassword();
  }

  // ── Write credentials file (gitignored) ───────────────────────
  const credLines = [
    '# Bakery CRM — Generated Demo Credentials',
    '# THIS FILE IS GITIGNORED. NEVER COMMIT IT.',
    '# Generated: ' + new Date().toISOString(),
    '',
    '| Username  | Display Name  | Role    | Password           |',
    '|-----------|---------------|---------|---------------------|',
    ...SEED_USERS.map((u) =>
      `| ${u.username.padEnd(9)} | ${u.displayName.padEnd(13)} | ${u.role.padEnd(7)} | ${passwords[u.username]} |`
    ),
    '',
    '## Login tabs',
    '- Owner Login tab:  admin only',
    '- Staff Login tab:  manager1, cashier1, cashier2, cashier3',
    '',
    '## Important',
    '- These passwords are generated fresh on each seed run.',
    '- After seeding, delete this file or store it in a password manager.',
    '- Never share these credentials outside the development environment.',
  ];
  const credPath = path.resolve(__dirname, '../../DEMO_CREDENTIALS.local.md');
  fs.writeFileSync(credPath, credLines.join('\n'), 'utf8');
  logger.info(`Credentials written to ${credPath}`);

  // ── Print to terminal (ONCE) ───────────────────────────────────
  console.log('\n' + '═'.repeat(65));
  console.log('  BAKERY CRM — GENERATED CREDENTIALS');
  console.log('  These will NOT be shown again. Save them now.');
  console.log('═'.repeat(65));
  for (const u of SEED_USERS) {
    console.log(`  ${u.role.toUpperCase().padEnd(8)}  ${u.username.padEnd(10)}  ${passwords[u.username]}`);
  }
  console.log('  Owner tab: admin only');
  console.log('  Staff tab: manager1, cashier1, cashier2, cashier3');
  console.log('═'.repeat(65) + '\n');

  // ── Default shop settings ─────────────────────────────────────
  await pool.query(`
    INSERT INTO settings (shop_name, address, phone, gstin, fssai_number, invoice_prefix, invoice_footer, tax_inclusive, currency)
    VALUES ('My Bakery', '', '', '', '', 'INV', 'Thank you! Visit again.', FALSE, 'INR')
    ON CONFLICT (id) DO NOTHING
  `);

  // ── Default categories ─────────────────────────────────────────
  const categories = ['Sweets', 'Dates', 'Chocolates', 'Bakery Items', 'Cakes', 'Cold Drinks', 'Snacks', 'Packaged Goods'];
  for (const name of categories) {
    await pool.query(
      `INSERT INTO categories (name, is_active, created_at)
       VALUES ($1, TRUE, NOW())
       ON CONFLICT (name) DO NOTHING`,
      [name]
    );
  }

  // ── Upsert users ──────────────────────────────────────────────
  // We upsert so that re-running the seed (e.g. after a migration)
  // resets passwords without duplicating rows.
  let adminId: number | null = null;

  for (const u of SEED_USERS) {
    const hash = await bcrypt.hash(passwords[u.username], env.bcryptRounds);

    const res = await pool.query<{ id: number }>(
      `INSERT INTO users
         (username, password_hash, role, display_name, is_active, failed_attempts, created_at, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, 0, NOW(), NOW())
       ON CONFLICT (username) DO UPDATE SET
         password_hash  = EXCLUDED.password_hash,
         role           = EXCLUDED.role,
         display_name   = EXCLUDED.display_name,
         is_active      = TRUE,
         failed_attempts = 0,
         locked_until   = NULL,
         updated_at     = NOW()
       RETURNING id`,
      [u.username, hash, u.role, u.displayName]
    );

    if (u.role === Role.Admin) {
      adminId = res.rows[0].id;
    }

    // Set created_by = self for the admin; set to adminId for others
    // We do this in a second pass once adminId is known.
  }

  // ── Set created_by for all users ──────────────────────────────
  if (adminId !== null) {
    await pool.query(
      `UPDATE users SET created_by = $1 WHERE created_by IS NULL`,
      [adminId]
    );
  }

  logger.info('Seed complete. 5 accounts created/updated.');
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Seed failed', err);
    pool.end().finally(() => process.exit(1));
  });
