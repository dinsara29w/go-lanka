import "server-only";

import { SITE_NAME } from "@/lib/site";
import { escapeHtml } from "@/server/email/templates";

export function buildAdminInviteEmail(input: { inviteUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: `You have been invited to the ${SITE_NAME} admin`,
    text: [
      `You have been invited to manage ${SITE_NAME}.`,
      "",
      `Open this single-use link within 24 hours: ${input.inviteUrl}`,
      "",
      "You will choose a password and enrol an authenticator app before signing in.",
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1f2937;">
        <h1 style="font-size: 20px;">You have been invited to the admin</h1>
        <p>You have been invited to manage ${SITE_NAME}.</p>
        <p>
          <a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block; padding:10px 16px; background:#111827; color:#fff; text-decoration:none; border-radius:8px;">
            Set up your account
          </a>
        </p>
        <p>This single-use link expires in 24 hours.</p>
        <p>You will choose a password and enrol an authenticator app before signing in.</p>
      </div>
    `.trim(),
  };
}
