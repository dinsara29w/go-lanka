import "server-only";

import type { Pool, PoolClient } from "pg";

export type AuditEvent = {
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditEvent(
  database: Pool | PoolClient,
  event: AuditEvent,
): Promise<void> {
  await database.query(
    `INSERT INTO admin_audit_log
       (actor_id, action, entity_type, entity_id, ip_hash, user_agent_hash, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      event.actorId ?? null,
      event.action,
      event.entityType ?? null,
      event.entityId ?? null,
      event.ipHash ?? null,
      event.userAgentHash ?? null,
      JSON.stringify(event.metadata ?? {}),
    ],
  );
}
