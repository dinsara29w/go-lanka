import "server-only";

import { decryptMfaSecret, verifyTotp } from "@/server/auth/mfa";
import {
  hashPassword,
  passwordNeedsRehash,
  verifyDummyPassword,
  verifyPassword,
} from "@/server/auth/password";
import { writeAuditEvent } from "@/server/auth/audit";
import { getAuthPool } from "@/server/db/pools";
import { getLogger } from "@/server/security/logger";
import { consumeRateLimit, buildRateLimitKey } from "@/server/security/rate-limit";
import { hashValue } from "@/server/security/request";
import type { AdminRole } from "@/server/auth/sessions";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_SECONDS = 15 * 60;

type AdminRow = {
  id: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  is_active: boolean;
  mfa_secret_encrypted: string | null;
  mfa_enabled: boolean;
  mfa_last_used_step: string | number | null;
  failed_login_count: number;
  locked_until: Date | null;
};

export type LoginResult =
  | { ok: true; admin: { id: string; email: string; role: AdminRole } }
  | { ok: false; reason: "invalid" | "rate_limited" }
  | { ok: false; reason: "mfa_required" }
  | { ok: false; reason: "mfa_invalid" }
  | { ok: false; reason: "mfa_setup_required"; adminId: string };

async function recordFailure(row: AdminRow | null, ipHash: string, userAgentHash: string) {
  const pool = getAuthPool();

  if (row) {
    const nextCount = row.failed_login_count + 1;
    await pool.query(
      `UPDATE admin_users
       SET failed_login_count = $2,
           locked_until = CASE WHEN $2 >= $3 THEN now() + make_interval(mins => $4) ELSE locked_until END
       WHERE id = $1`,
      [row.id, nextCount, MAX_FAILED_ATTEMPTS, LOCK_MINUTES],
    );
  }

  await writeAuditEvent(pool, {
    actorId: row?.id ?? null,
    action: "admin.login.failed",
    entityType: "admin_user",
    entityId: row?.id ?? null,
    ipHash,
    userAgentHash,
    metadata: { reason: "invalid_credentials" },
  });
}

export async function verifyAdminLogin(input: {
  email: string;
  password: string;
  totp?: string;
  ipHash: string;
  userAgentHash: string;
}): Promise<LoginResult> {
  const pool = getAuthPool();
  const email = input.email.trim().toLowerCase();
  const accountKey = buildRateLimitKey("admin-login-account", hashValue(email, "admin-account"));
  const ipKey = buildRateLimitKey("admin-login-ip", input.ipHash);

  const [ipAllowed, accountAllowed] = await Promise.all([
    consumeRateLimit(pool, {
      key: ipKey,
      limit: LOGIN_RATE_LIMIT,
      windowSeconds: LOGIN_RATE_WINDOW_SECONDS,
    }),
    consumeRateLimit(pool, {
      key: accountKey,
      limit: LOGIN_RATE_LIMIT,
      windowSeconds: LOGIN_RATE_WINDOW_SECONDS,
    }),
  ]);

  if (!ipAllowed || !accountAllowed) {
    getLogger().warn({ event: "admin_login_rate_limited" }, "admin_login_rate_limited");
    return { ok: false, reason: "rate_limited" };
  }

  const result = await pool.query<AdminRow>(
    `SELECT id, email, password_hash, role, is_active, mfa_secret_encrypted,
            mfa_enabled, mfa_last_used_step, failed_login_count, locked_until
     FROM admin_users
     WHERE lower(email) = $1
     LIMIT 1`,
    [email],
  );

  const row = result.rows[0];
  if (!row) {
    await verifyDummyPassword(input.password);
    await recordFailure(null, input.ipHash, input.userAgentHash);
    return { ok: false, reason: "invalid" };
  }

  if (!row.is_active) {
    await verifyDummyPassword(input.password);
    await writeAuditEvent(pool, {
      actorId: row.id,
      action: "admin.login.failed",
      entityType: "admin_user",
      entityId: row.id,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
      metadata: { reason: "inactive" },
    });
    return { ok: false, reason: "invalid" };
  }

  if (row.locked_until && row.locked_until.getTime() > Date.now()) {
    await verifyDummyPassword(input.password);
    await writeAuditEvent(pool, {
      actorId: row.id,
      action: "admin.login.failed",
      entityType: "admin_user",
      entityId: row.id,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
      metadata: { reason: "locked" },
    });
    return { ok: false, reason: "invalid" };
  }

  if (!(await verifyPassword(row.password_hash, input.password))) {
    await recordFailure(row, input.ipHash, input.userAgentHash);
    return { ok: false, reason: "invalid" };
  }

  if (!row.mfa_enabled || !row.mfa_secret_encrypted) {
    await writeAuditEvent(pool, {
      actorId: row.id,
      action: "admin.login.mfa_setup_required",
      entityType: "admin_user",
      entityId: row.id,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
      metadata: {},
    });
    return { ok: false, reason: "mfa_setup_required", adminId: row.id };
  }

  if (!input.totp) {
    return { ok: false, reason: "mfa_required" };
  }

  let mfaSecret: string;
  try {
    mfaSecret = decryptMfaSecret(row.mfa_secret_encrypted);
  } catch (error) {
    getLogger().error(
      { err: error, event: "admin_mfa_decrypt_failed" },
      "admin_mfa_decrypt_failed",
    );
    await recordFailure(row, input.ipHash, input.userAgentHash);
    return { ok: false, reason: "invalid" };
  }

  const lastStep =
    row.mfa_last_used_step === null ? null : Number.parseInt(String(row.mfa_last_used_step), 10);
  const totp = await verifyTotp(mfaSecret, input.totp, lastStep);
  if (!totp.valid || totp.timeStep === undefined) {
    await recordFailure(row, input.ipHash, input.userAgentHash);
    return { ok: false, reason: "mfa_invalid" };
  }

  const newPasswordHash = passwordNeedsRehash(row.password_hash)
    ? await hashPassword(input.password)
    : null;

  await pool.query(
    `UPDATE admin_users
     SET failed_login_count = 0,
         locked_until = NULL,
         last_login_at = now(),
         mfa_last_used_step = $2,
         password_hash = COALESCE($3, password_hash)
     WHERE id = $1`,
    [row.id, totp.timeStep, newPasswordHash],
  );

  await writeAuditEvent(pool, {
    actorId: row.id,
    action: "admin.login.succeeded",
    entityType: "admin_user",
    entityId: row.id,
    ipHash: input.ipHash,
    userAgentHash: input.userAgentHash,
    metadata: {},
  });

  return { ok: true, admin: { id: row.id, email: row.email, role: row.role } };
}
