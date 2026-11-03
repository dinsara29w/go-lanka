"use server";

import { revalidatePath } from "next/cache";

import { randomBytes } from "node:crypto";

import { strings } from "@/content/strings";
import { getSiteUrl } from "@/lib/site";
import { createAdminSchema } from "@/lib/validation/auth";
import { siteSettingsSchema } from "@/lib/validation/settings";
import { writeAuditEvent } from "@/server/auth/audit";
import { hashPassword } from "@/server/auth/password";
import { createAdminPasswordToken } from "@/server/auth/reset";
import { requireAdminMutation, requireOwnerMutation } from "@/server/auth/require-admin";
import { revokeAllSessionsForAdmin, revokeSessionForAdmin } from "@/server/auth/sessions";
import { getAdminPool, getAuthPool } from "@/server/db/pools";
import { buildAdminInviteEmail } from "@/server/email/admin-invite";
import { sendEmail } from "@/server/email/send";
import { getLogger } from "@/server/security/logger";

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const sessionId = formValue(formData, "sessionId");
  if (!sessionId || sessionId === session.sessionId) return;

  const revoked = await revokeSessionForAdmin(sessionId, session.admin.id);
  if (revoked) {
    await writeAuditEvent(getAuthPool(), {
      actorId: session.admin.id,
      action: "admin.session.revoked",
      entityType: "admin_session",
      entityId: sessionId,
      ipHash: null,
      userAgentHash: null,
      metadata: {},
    });
  }
  revalidatePath("/admin/sessions");
}

export async function revokeAllOtherSessionsAction(formData: FormData): Promise<void> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  await revokeAllSessionsForAdmin(session.admin.id, session.sessionId);
  await writeAuditEvent(getAuthPool(), {
    actorId: session.admin.id,
    action: "admin.session.revoked_all_others",
    entityType: "admin_user",
    entityId: session.admin.id,
    ipHash: null,
    userAgentHash: null,
    metadata: {},
  });
  revalidatePath("/admin/sessions");
}

export type SettingsActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export async function saveSettingsAction(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await requireAdminMutation(formValue(formData, "_csrf"));
  const parsed = siteSettingsSchema.safeParse({
    whatsappNumber: formValue(formData, "whatsappNumber"),
    contactEmail: formValue(formData, "contactEmail"),
    phone: formValue(formData, "phone"),
    facebook: formValue(formData, "facebook"),
    instagram: formValue(formData, "instagram"),
    youtube: formValue(formData, "youtube"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const socials = Object.fromEntries(
    Object.entries({
      facebook: parsed.data.facebook?.trim(),
      instagram: parsed.data.instagram?.trim(),
      youtube: parsed.data.youtube?.trim(),
    }).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  await getAdminPool().query(
    `INSERT INTO site_settings (singleton, whatsapp_number, contact_email, phone, socials)
     VALUES (true, $1, $2, $3, $4::jsonb)
     ON CONFLICT (singleton) DO UPDATE
     SET whatsapp_number = EXCLUDED.whatsapp_number,
         contact_email = EXCLUDED.contact_email,
         phone = EXCLUDED.phone,
         socials = EXCLUDED.socials`,
    [
      parsed.data.whatsappNumber?.trim() || null,
      parsed.data.contactEmail?.trim() || null,
      parsed.data.phone?.trim() || null,
      JSON.stringify(socials),
    ],
  );

  await writeAuditEvent(getAdminPool(), {
    actorId: session.admin.id,
    action: "settings.updated",
    entityType: "site_settings",
    entityId: "singleton",
    ipHash: null,
    userAgentHash: null,
    metadata: { fields: Object.keys(socials).length ? ["contact", "socials"] : ["contact"] },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  revalidatePath("/contact");

  return { ok: true, message: strings.admin.settingsSaved };
}

export type InviteActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export async function inviteAdminAction(
  _previous: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const session = await requireOwnerMutation(formValue(formData, "_csrf"));
  const parsed = createAdminSchema.safeParse({ email: formValue(formData, "email") });
  if (!parsed.success) return { error: strings.admin.genericError };

  const pool = getAdminPool();
  const existing = await pool.query("SELECT id FROM admin_users WHERE lower(email) = $1", [
    parsed.data.email,
  ]);
  if (existing.rowCount) return { error: strings.admin.inviteEmailExists };

  const discardedPassword = randomBytes(32).toString("base64url");
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(discardedPassword);
  } catch (error) {
    getLogger().error(
      { err: error, event: "admin_invite_hash_failed" },
      "admin_invite_hash_failed",
    );
    return { error: strings.admin.genericError };
  }

  const inserted = await pool.query<{ id: string; email: string }>(
    `INSERT INTO admin_users (email, password_hash, role, is_active, password_changed_at)
     VALUES ($1, $2, 'admin', true, now())
     RETURNING id, email`,
    [parsed.data.email, passwordHash],
  );
  const admin = inserted.rows[0];
  if (!admin) return { error: strings.admin.genericError };

  const token = await createAdminPasswordToken({
    adminUserId: admin.id,
    purpose: "invite",
    ipHash: null,
  });
  const inviteUrl = new URL(
    `/admin/setup?token=${encodeURIComponent(token)}`,
    getSiteUrl(),
  ).toString();
  const template = buildAdminInviteEmail({ inviteUrl });

  try {
    await sendEmail(
      { to: admin.email, subject: template.subject, html: template.html, text: template.text },
      { requestId: `invite-${admin.id}` },
    );
  } catch (error) {
    getLogger().error(
      { err: error, event: "admin_invite_email_failed" },
      "admin_invite_email_failed",
    );
    await writeAuditEvent(pool, {
      actorId: session.admin.id,
      action: "admin.user.invited",
      entityType: "admin_user",
      entityId: admin.id,
      ipHash: null,
      userAgentHash: null,
      metadata: { delivery: "failed" },
    });
    return { error: strings.admin.inviteDeliveryFailed };
  }

  await writeAuditEvent(pool, {
    actorId: session.admin.id,
    action: "admin.user.invited",
    entityType: "admin_user",
    entityId: admin.id,
    ipHash: null,
    userAgentHash: null,
    metadata: { delivery: "sent" },
  });

  revalidatePath("/admin/team");
  return { ok: true, message: strings.admin.inviteCreated };
}
