import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wrap an async route handler so rejected promises are forwarded to the
 * error-handling middleware instead of crashing the process.
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
