import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Collect express-validator results and return 422 with the list
 * of field-level errors. Use as the last middleware in a validation chain.
 */
export function validate(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    next();
    return;
  }
  res.status(422).json({
    error: 'Validation failed',
    details: errors.array().map((e) => ({
      field: e.type === 'field' ? e.path : e.type,
      message: e.msg,
    })),
  });
}
