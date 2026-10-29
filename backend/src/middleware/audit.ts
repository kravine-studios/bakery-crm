import { Request } from 'express';
import { query } from '../config/database';
import { AuditAction } from '../types/enums';

/**
 * Write a single audit-log row.
 * Call this from controllers after a state-changing operation.
 *
 * All money fields and before/after values are stored as JSONB so the
 * audit trail stays flexible without schema changes.
 */
export async function auditLog(params: {
  userId: number;
  action: AuditAction;
  entity: string;       // e.g. 'product', 'bill', 'stock_adjustment'
  entityId?: number | string;
  before?: unknown;
  after?: unknown;
  req?: Request;        // for IP and user-agent
  reason?: string;
}): Promise<void> {
  await query(
    `INSERT INTO audit_log
       (user_id, action, entity, entity_id, before, after, ip_address, user_agent, reason, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      params.userId,
      params.action,
      params.entity,
      params.entityId ?? null,
      params.before ? JSON.stringify(params.before) : null,
      params.after ? JSON.stringify(params.after) : null,
      params.req?.ip ?? null,
      params.req?.get('user-agent') ?? null,
      params.reason ?? null,
    ]
  );
}
