import "server-only";

import { getAuthPool } from "@/server/db/pools";
import { withTransaction } from "@/server/db/pools";
import {
  buildMfaQrDataUrl,
  createMfaSecret,
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyTotp,
} from "@/server/auth/mfa";
import { hashPassword, validatePassword } from "@/server/auth/password";
import { findAdminPasswordTokenAny } from "@/server/auth/reset";
import { hashToken } from "@/server/security/request";
import type { AdminRole } from "@/server/auth/sessions";

export class SetupError extends Error {
  constructor(readonly code: "invalid_token" | "invalid_totp" | "password_policy" | "expired") {
    super(code);
    this.name = "SetupError";
  }
}

export async function beginAdminSetup(token: string): Promise<{
  email: string;
  qrDataUrl: string;
  purpose: "reset" | "invite";
} | null> {
  const tokenRecord = await findAdminPasswordTokenAny(token);
  if (!tokenRecord) return null;

  const secret = createMfaSecret();
  const encrypted = encryptMfaSecret(secret);

  await getAuthPool().query(
    `UPDATE admin_users
     SET mfa_secret_encrypted = $2,
         mfa_enabled = false,
         mfa_last_used_step = NULL
     WHERE id = $1 AND is_active = true`,
    [tokenRecord.adminUserId, encrypted],
  );

  return {
    email: tokenRecord.email,
    qrDataUrl: await buildMfaQrDataUrl(secret, tokenRecord.email),
    purpose: tokenRecord.purpose,
  };
}

export async function completeAdminSetup(input: {
  token: string;
  password: string;
  totp: string;
  ipHash: string;
  userAgentHash: string;
}): Promise<{
  admin: { id: string; email: string; role: AdminRole };
  recoveryCodes: string[];
}> {
  const tokenRecord = await findAdminPasswordTokenAny(input.token);
  if (!tokenRecord) throw new SetupError("invalid_token");

  const policyError = validatePassword(input.password, tokenRecord.email);
  if (policyError) throw new SetupError("password_policy");

  const adminResult = await getAuthPool().query<{
    id: string;
    email: string;
    role: AdminRole;
    mfa_secret_encrypted: string | null;
  }>(
    `SELECT id, email, role, mfa_secret_encrypted
     FROM admin_users
     WHERE id = $1 AND is_active = true`,
    [tokenRecord.adminUserId],
  );
  const admin = adminResult.rows[0];
  if (!admin?.mfa_secret_encrypted) throw new SetupError("invalid_token");

  let secret: string;
  try {
    secret = decryptMfaSecret(admin.mfa_secret_encrypted);
  } catch {
    throw new SetupError("invalid_token");
  }

  const totp = await verifyTotp(secret, input.totp);
  if (!totp.valid || totp.timeStep === undefined) throw new SetupError("invalid_totp");

  const [passwordHash, recoveryCodes] = await Promise.all([
    hashPassword(input.password),
    Promise.resolve(generateRecoveryCodes(10)),
  ]);
  const recoveryHashes = recoveryCodes.map((code) => hashRecoveryCode(code));

  await withTransaction(getAuthPool(), async (client) => {
    const tokenRow = await client.query<{ admin_user_id: string }>(
      `SELECT admin_user_id
       FROM admin_password_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > now()
       FOR UPDATE`,
      [hashToken(input.token)],
    );
    if (!tokenRow.rows[0] || tokenRow.rows[0].admin_user_id !== admin.id) {
      throw new SetupError("expired");
    }

    await client.query(
      `UPDATE admin_users
       SET password_hash = $2,
           mfa_enabled = true,
           mfa_last_used_step = $3,
           password_changed_at = now(),
           failed_login_count = 0,
           locked_until = NULL
       WHERE id = $1`,
      [admin.id, passwordHash, totp.timeStep],
    );

    await client.query(
      `UPDATE admin_password_tokens
       SET used_at = now()
       WHERE admin_user_id = $1 AND used_at IS NULL`,
      [admin.id],
    );

    await client.query("DELETE FROM admin_mfa_recovery_codes WHERE admin_user_id = $1", [admin.id]);
    for (const codeHash of recoveryHashes) {
      await client.query(
        `INSERT INTO admin_mfa_recovery_codes (admin_user_id, code_hash) VALUES ($1, $2)`,
        [admin.id, codeHash],
      );
    }

    await client.query(
      `INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, ip_hash, user_agent_hash, metadata)
       VALUES ($1, 'admin.setup.completed', 'admin_user', $4::text, $2, $3, '{}'::jsonb)`,
      [admin.id, input.ipHash, input.userAgentHash, admin.id],
    );
  });

  return { admin: { id: admin.id, email: admin.email, role: admin.role }, recoveryCodes };
}
