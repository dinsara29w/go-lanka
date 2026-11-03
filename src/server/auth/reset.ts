import "server-only";

import type { PoolClient } from "pg";

import { getAuthPool } from "@/server/db/pools";
import { generateToken, hashToken } from "@/server/security/request";

export const PASSWORD_TOKEN_TTL_MINUTES = 30;
export const INVITE_TOKEN_TTL_HOURS = 24;

export async function createAdminPasswordToken(input: {
  adminUserId: string;
  purpose: "reset" | "invite";
  ipHash?: string | null;
}): Promise<string> {
  const token = generateToken(32);
  const ttl =
    input.purpose === "invite"
      ? `make_interval(hours => ${INVITE_TOKEN_TTL_HOURS})`
      : `make_interval(mins => ${PASSWORD_TOKEN_TTL_MINUTES})`;

  await getAuthPool().query(
    `INSERT INTO admin_password_tokens
       (admin_user_id, token_hash, purpose, expires_at, requested_ip_hash)
     VALUES ($1, $2, $3, now() + ${ttl}, $4)`,
    [input.adminUserId, hashToken(token), input.purpose, input.ipHash ?? null],
  );
  return token;
}

export async function findAdminPasswordToken(
  token: string,
  purpose: "reset" | "invite",
): Promise<{ adminUserId: string; email: string } | null> {
  if (!token || token.length > 200) return null;

  const result = await getAuthPool().query<{ admin_user_id: string; email: string }>(
    `SELECT t.admin_user_id, u.email
     FROM admin_password_tokens t
     JOIN admin_users u ON u.id = t.admin_user_id
     WHERE t.token_hash = $1
       AND t.purpose = $2
       AND t.used_at IS NULL
       AND t.expires_at > now()
       AND u.is_active = true
     LIMIT 1`,
    [hashToken(token), purpose],
  );

  const row = result.rows[0];
  return row ? { adminUserId: row.admin_user_id, email: row.email } : null;
}

export async function findAdminPasswordTokenAny(
  token: string,
): Promise<{ adminUserId: string; email: string; purpose: "reset" | "invite" } | null> {
  if (!token || token.length > 200) return null;

  const result = await getAuthPool().query<{
    admin_user_id: string;
    email: string;
    purpose: "reset" | "invite";
  }>(
    `SELECT t.admin_user_id, u.email, t.purpose
     FROM admin_password_tokens t
     JOIN admin_users u ON u.id = t.admin_user_id
     WHERE t.token_hash = $1
       AND t.used_at IS NULL
       AND t.expires_at > now()
       AND u.is_active = true
     LIMIT 1`,
    [hashToken(token)],
  );

  const row = result.rows[0];
  return row ? { adminUserId: row.admin_user_id, email: row.email, purpose: row.purpose } : null;
}

export async function consumeAdminPasswordTokenWithClient(
  client: PoolClient,
  token: string,
  purpose: "reset" | "invite",
): Promise<string | null> {
  if (!token || token.length > 200) return null;

  const result = await client.query<{ admin_user_id: string }>(
    `UPDATE admin_password_tokens
     SET used_at = now()
     WHERE token_hash = $1
       AND purpose = $2
       AND used_at IS NULL
       AND expires_at > now()
     RETURNING admin_user_id`,
    [hashToken(token), purpose],
  );

  return result.rows[0]?.admin_user_id ?? null;
}

export async function consumeAdminPasswordToken(
  token: string,
  purpose: "reset" | "invite",
): Promise<string | null> {
  if (!token || token.length > 200) return null;

  const result = await getAuthPool().query<{ admin_user_id: string }>(
    `UPDATE admin_password_tokens
     SET used_at = now()
     WHERE token_hash = $1
       AND purpose = $2
       AND used_at IS NULL
       AND expires_at > now()
     RETURNING admin_user_id`,
    [hashToken(token), purpose],
  );

  return result.rows[0]?.admin_user_id ?? null;
}

export async function invalidatePasswordTokens(adminUserId: string): Promise<void> {
  await getAuthPool().query(
    `UPDATE admin_password_tokens
     SET used_at = now()
     WHERE admin_user_id = $1 AND used_at IS NULL`,
    [adminUserId],
  );
}
