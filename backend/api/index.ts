/**
 * Vercel Serverless Entry Point
 *
 * This file exports the Express application as a serverless function so
 * it can be deployed on Vercel. The business logic in src/ is unchanged.
 *
 * IMPORTANT — PostgreSQL connection pool in serverless:
 *   pg.Pool keeps persistent idle connections. In a serverless environment
 *   each function invocation is short-lived, so pool.min must be 0 to avoid
 *   creating idle connections that are never cleaned up.
 *   Set DB_POOL_MIN=0 and DB_POOL_MAX=1 in your Vercel backend env vars.
 *
 *   Alternatively, use a serverless-optimised Postgres proxy such as
 *   Neon (neon.tech) or Supabase, which support HTTP-based queries and
 *   handle connection pooling at their edge.
 *
 * NOTE: The migrate.ts and seed.ts scripts still work via CLI —
 *   npx ts-node src/db/migrate.ts  (run once from your local machine or CI)
 */

import { createApp } from '../src/app';

// createApp() builds the Express app with all routes and middleware.
// We do NOT call app.listen() here — Vercel provides the HTTP server.
const app = createApp();

export default app;
