import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom API error carrying an HTTP status code.
 */
export class ApiError extends Error {
  statusCode: number;
  details?: unknown;
  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
};

/**
 * Central error handler. Must be registered LAST (after all routes).
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message, details: err.details });
    return;
  }

  // Postgres unique-violation / foreign-key errors
  const pgErr = err as { code?: string; detail?: string; constraint?: string };
  if (pgErr.code === '23505') {
    res.status(409).json({ error: 'Duplicate value', detail: pgErr.detail });
    return;
  }
  if (pgErr.code === '23503') {
    res.status(409).json({ error: 'Referenced record does not exist', detail: pgErr.detail });
    return;
  }

  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
};
