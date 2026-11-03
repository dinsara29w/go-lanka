import "server-only";

import { cookies } from "next/headers";

import { deriveCsrfToken, hashStoredCsrfToken } from "@/server/auth/csrf";
import { getAuthPool } from "@/server/db/pools";
import { getServerEnv } from "@/server/env";
import { generateToken, hashToken, safeEqual } from "@/server/security/request";

export const SESSION_IDLE_MINUTES = 60;
export const SESSION_ABSOLUTE_HOURS = 12;

export type AdminRole = "owner" | "admin";

export type CurrentAdmin = {
  id: string;
  email: string;
  role: AdminRole;
};

export type CurrentSession = {
  sessionId: string;
  admin: CurrentAdmin;
  csrfToken: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
};

type SessionRow = {
  id: string;
  admin_user_id: string;
  csrf_token_hash: string;
  expires_at: Date;
  absolute_expires_at: Date;
  last_seen_at: Date;
  email: string;
  role: AdminRole;
  is_active: boolean;
};

function sessionCookieName(): string {
  return getServerEnv().NODE_ENV === "production" ? "__Host-gl_admin" : "gl_admin_dev";
}

async function setSessionCookie(token: string, absoluteExpiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: getServerEnv().NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: absoluteExpiresAt,
    priority: "high",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(sessionCookieName(), "", {
    httpOnly: true,
    secure: getServerEnv().NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  });
}

async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(sessionCookieName())?.value ?? null;
}

export async function createAdminSession(input: {
  adminUserId: string;
  ipHash: string | null;
  userAgentHash: string | null;
}): Promise<{ token: string; csrfToken: string; sessionId: string; absoluteExpiresAt: Date }> {
  const token = generateToken(32);
  const csrfToken = deriveCsrfToken(token);
  const csrfTokenHash = hashStoredCsrfToken(csrfToken);

  const result = await getAuthPool().query<{
    id: string;
    absolute_expires_at: Date;
  }>(
    `INSERT INTO admin_sessions
       (admin_user_id, token_hash, csrf_token_hash, ip_hash, user_agent_hash, expires_at, absolute_expires_at)
     VALUES
       ($1, $2, $3, $4, $5, now() + make_interval(mins => $6), now() + make_interval(hours => $7))
     RETURNING id, absolute_expires_at`,
    [
      input.adminUserId,
      hashToken(token),
      csrfTokenHash,
      input.ipHash,
      input.userAgentHash,
      SESSION_IDLE_MINUTES,
      SESSION_ABSOLUTE_HOURS,
    ],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Failed to create admin session");

  await setSessionCookie(token, row.absolute_expires_at);
  return { token, csrfToken, sessionId: row.id, absoluteExpiresAt: row.absolute_expires_at };
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const token = await readSessionToken();
  if (!token) return null;

  const result = await getAuthPool().query<SessionRow>(
    `SELECT s.id, s.admin_user_id, s.csrf_token_hash, s.expires_at,
            s.absolute_expires_at, s.last_seen_at, u.email, u.role, u.is_active
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.admin_user_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
       AND s.absolute_expires_at > now()
     LIMIT 1`,
    [hashToken(token)],
  );

  const row = result.rows[0];
  if (!row || !row.is_active) return null;

  const csrfToken = deriveCsrfToken(token);
  if (!safeEqual(hashStoredCsrfToken(csrfToken), row.csrf_token_hash)) {
    return null;
  }

  if (Date.now() - row.last_seen_at.getTime() > 5 * 60 * 1000) {
    await getAuthPool().query(
      `UPDATE admin_sessions
       SET last_seen_at = now(),
           expires_at = LEAST(
             now() + make_interval(mins => $2),
             absolute_expires_at
           )
       WHERE id = $1 AND last_seen_at < now() - interval '5 minutes'`,
      [row.id, SESSION_IDLE_MINUTES],
    );
  }

  return {
    sessionId: row.id,
    admin: {
      id: row.admin_user_id,
      email: row.email,
      role: row.role,
    },
    csrfToken,
    expiresAt: row.expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
  };
}

export async function revokeCurrentSession(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    await getAuthPool().query(
      `UPDATE admin_sessions SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(token)],
    );
  }
  await clearSessionCookie();
}

export async function revokeSessionForAdmin(
  sessionId: string,
  adminUserId: string,
): Promise<boolean> {
  const result = await getAuthPool().query(
    `UPDATE admin_sessions SET revoked_at = now()
     WHERE id = $1 AND admin_user_id = $2 AND revoked_at IS NULL`,
    [sessionId, adminUserId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function revokeAllSessionsForAdmin(
  adminUserId: string,
  exceptSessionId?: string,
): Promise<void> {
  await getAuthPool().query(
    `UPDATE admin_sessions SET revoked_at = now()
     WHERE admin_user_id = $1
       AND revoked_at IS NULL
       AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [adminUserId, exceptSessionId ?? null],
  );
}

export async function listSessionsForAdmin(adminUserId: string): Promise<
  Array<{
    id: string;
    ipHash: string | null;
    userAgentHash: string | null;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
    absoluteExpiresAt: Date;
    revokedAt: Date | null;
    isActive: boolean;
  }>
> {
  const result = await getAuthPool().query<{
    id: string;
    ip_hash: string | null;
    user_agent_hash: string | null;
    created_at: Date;
    last_seen_at: Date;
    expires_at: Date;
    absolute_expires_at: Date;
    revoked_at: Date | null;
    is_active: boolean;
  }>(
    `SELECT id, ip_hash, user_agent_hash, created_at, last_seen_at,
            expires_at, absolute_expires_at, revoked_at,
            (revoked_at IS NULL AND expires_at > now() AND absolute_expires_at > now()) AS is_active
     FROM admin_sessions
     WHERE admin_user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [adminUserId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    ipHash: row.ip_hash,
    userAgentHash: row.user_agent_hash,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
    revokedAt: row.revoked_at,
    isActive: row.is_active,
  }));
}
