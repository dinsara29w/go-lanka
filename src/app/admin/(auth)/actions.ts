"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { strings } from "@/content/strings";
import { adminLoginSchema, adminSetupSchema, forgotPasswordSchema } from "@/lib/validation/auth";
import { getSiteUrl } from "@/lib/site";
import { writeAuditEvent } from "@/server/auth/audit";
import { createAdminSession } from "@/server/auth/sessions";
import { verifyAdminLogin } from "@/server/auth/login";
import { createAdminPasswordToken } from "@/server/auth/reset";
import { SetupError, completeAdminSetup } from "@/server/auth/setup";
import { clearSetupRecoveryCodes, setSetupRecoveryCodes } from "@/server/auth/setup-cookies";
import { requireAdminMutation } from "@/server/auth/require-admin";
import { getAuthPool } from "@/server/db/pools";
import { sendEmail } from "@/server/email/send";
import { buildPasswordResetEmail } from "@/server/email/auth-emails";
import { getLogger } from "@/server/security/logger";
import { buildRateLimitKey, consumeRateLimit } from "@/server/security/rate-limit";
import { getRequestMetadataFromHeaders, hashValue } from "@/server/security/request";

export type AuthActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
  recoveryCodes?: string[];
  email?: string;
};

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function loginAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = adminLoginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    totp: formValue(formData, "totp"),
  });

  if (!parsed.success) {
    return { error: strings.admin.invalidCredentials };
  }

  const metadata = getRequestMetadataFromHeaders(await headers());

  let result: Awaited<ReturnType<typeof verifyAdminLogin>>;
  try {
    result = await verifyAdminLogin({
      email: parsed.data.email,
      password: parsed.data.password,
      totp: parsed.data.totp || undefined,
      ipHash: metadata.ipHash,
      userAgentHash: metadata.userAgentHash,
    });
  } catch (error) {
    getLogger().error(
      { err: error, event: "admin_login_action_failed" },
      "admin_login_action_failed",
    );
    return { error: strings.admin.genericError };
  }

  if (result.ok) {
    try {
      await createAdminSession({
        adminUserId: result.admin.id,
        ipHash: metadata.ipHash,
        userAgentHash: metadata.userAgentHash,
      });
    } catch (error) {
      getLogger().error(
        { err: error, event: "admin_session_create_failed" },
        "admin_session_create_failed",
      );
      return { error: strings.admin.genericError };
    }
    redirect("/admin");
  }

  switch (result.reason) {
    case "rate_limited":
      return { error: strings.admin.rateLimited };
    case "mfa_required":
      return { error: strings.admin.mfaRequired };
    case "mfa_setup_required":
      return { error: strings.admin.setupRequired };
    default:
      return { error: strings.admin.invalidCredentials };
  }
}

export async function forgotPasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formValue(formData, "email") });
  if (!parsed.success) {
    return { ok: true, message: strings.admin.resetEmailSent };
  }

  const metadata = getRequestMetadataFromHeaders(await headers());
  const pool = getAuthPool();
  const emailKey = buildRateLimitKey(
    "admin-reset-email",
    hashValue(parsed.data.email, "admin-reset-email"),
  );
  const ipKey = buildRateLimitKey("admin-reset-ip", metadata.ipHash);

  try {
    const [ipAllowed, emailAllowed] = await Promise.all([
      consumeRateLimit(pool, { key: ipKey, limit: 3, windowSeconds: 60 * 60 }),
      consumeRateLimit(pool, { key: emailKey, limit: 3, windowSeconds: 60 * 60 }),
    ]);
    if (!ipAllowed || !emailAllowed) {
      return { ok: true, message: strings.admin.resetEmailSent };
    }

    const admin = await pool.query<{ id: string; email: string }>(
      `SELECT id, email FROM admin_users
       WHERE lower(email) = $1 AND is_active = true
       LIMIT 1`,
      [parsed.data.email],
    );
    const row = admin.rows[0];
    if (!row) {
      return { ok: true, message: strings.admin.resetEmailSent };
    }

    const token = await createAdminPasswordToken({
      adminUserId: row.id,
      purpose: "reset",
      ipHash: metadata.ipHash,
    });
    const resetUrl = new URL(
      `/admin/setup?token=${encodeURIComponent(token)}`,
      getSiteUrl(),
    ).toString();
    const template = buildPasswordResetEmail({ email: row.email, resetUrl });

    try {
      await sendEmail(
        {
          to: row.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        },
        { requestId: metadata.requestId },
      );
    } catch (error) {
      getLogger().error(
        { err: error, event: "admin_reset_email_failed" },
        "admin_reset_email_failed",
      );
    }

    await writeAuditEvent(pool, {
      actorId: row.id,
      action: "admin.password.reset_requested",
      entityType: "admin_user",
      entityId: row.id,
      ipHash: metadata.ipHash,
      userAgentHash: metadata.userAgentHash,
      metadata: {},
    });

    return { ok: true, message: strings.admin.resetEmailSent };
  } catch (error) {
    getLogger().error(
      { err: error, event: "admin_reset_action_failed" },
      "admin_reset_action_failed",
    );
    return { ok: true, message: strings.admin.resetEmailSent };
  }
}

export async function completeSetupAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = adminSetupSchema.safeParse({
    token: formValue(formData, "token"),
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword"),
    totp: formValue(formData, "totp"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? strings.admin.genericError };
  }

  const metadata = getRequestMetadataFromHeaders(await headers());

  try {
    const result = await completeAdminSetup({
      token: parsed.data.token,
      password: parsed.data.password,
      totp: parsed.data.totp,
      ipHash: metadata.ipHash,
      userAgentHash: metadata.userAgentHash,
    });

    await setSetupRecoveryCodes(result.recoveryCodes);
    await createAdminSession({
      adminUserId: result.admin.id,
      ipHash: metadata.ipHash,
      userAgentHash: metadata.userAgentHash,
    });
  } catch (error) {
    if (error instanceof SetupError) {
      if (error.code === "invalid_totp") return { error: strings.admin.invalidTotp };
      if (error.code === "password_policy") return { error: strings.admin.passwordPolicy };
      return { error: strings.admin.setupExpired };
    }
    getLogger().error({ err: error, event: "admin_setup_failed" }, "admin_setup_failed");
    return { error: strings.admin.genericError };
  }

  redirect("/admin/setup/recovery");
}

export async function finishRecoveryAction(formData: FormData): Promise<void> {
  await requireAdminMutation(formValue(formData, "_csrf"));
  await clearSetupRecoveryCodes();
  redirect("/admin");
}
