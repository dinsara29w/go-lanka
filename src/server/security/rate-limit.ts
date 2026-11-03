import "server-only";

import type { Pool } from "pg";

import { hashValue } from "@/server/security/request";

export function buildRateLimitKey(...parts: Array<string | number>): string {
  return hashValue(parts.join("|"), "rate-limit");
}

export async function consumeRateLimit(
  pool: Pool,
  input: { key: string; limit: number; windowSeconds: number },
): Promise<boolean> {
  const result = await pool.query<{ allowed: boolean }>(
    "SELECT check_rate_limit($1, $2, $3) AS allowed",
    [input.key, input.limit, input.windowSeconds],
  );

  return result.rows[0]?.allowed === true;
}
