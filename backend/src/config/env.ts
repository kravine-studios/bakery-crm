import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return val;
}

function int(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: int('PORT', 4000),
  frontendUrl: required('FRONTEND_URL', 'http://localhost:5173'),

  db: {
    host: required('DB_HOST', 'localhost'),
    port: int('DB_PORT', 5432),
    name: required('DB_NAME', 'bakery_crm'),
    user: required('DB_USER', 'postgres'),
    password: required('DB_PASSWORD', 'postgres'),
    poolMin: int('DB_POOL_MIN', 2),
    poolMax: int('DB_POOL_MAX', 10),
  },

  jwt: {
    secret: required('JWT_SECRET', 'dev-secret-change-me-please-64chars-min-padding'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me-too'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  bcryptRounds: int('BCRYPT_ROUNDS', 12),

  rateLimit: {
    windowMs: int('RATE_LIMIT_WINDOW_MS', 900000),
    max: int('RATE_LIMIT_MAX', 100),
    loginMax: int('LOGIN_RATE_LIMIT_MAX', 10),
  },

  upload: {
    dir: process.env.UPLOAD_DIR ?? 'uploads',
    maxFileSizeMB: int('MAX_FILE_SIZE_MB', 5),
  },

  logLevel: process.env.LOG_LEVEL ?? 'info',
  fyStartMonth: int('FY_START_MONTH', 4),
  invoicePrefix: process.env.INVOICE_PREFIX ?? 'INV',
} as const;
