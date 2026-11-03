import "server-only";

import { SITE_NAME } from "@/lib/site";
import { escapeHtml } from "@/server/email/templates";

export function buildPasswordResetEmail(input: { email: string; resetUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: `Reset your ${SITE_NAME} admin password`,
    text: [
      `A password reset was requested for the ${SITE_NAME} admin account.`,
      "",
      `Open this single-use link within 30 minutes: ${input.resetUrl}`,
      "",
      "If you did not request this, ignore the email. Your password has not changed.",
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1f2937;">
        <h1 style="font-size: 20px;">Reset your admin password</h1>
        <p>A password reset was requested for ${escapeHtml(input.email)}.</p>
        <p>
          <a href="${escapeHtml(input.resetUrl)}" style="display:inline-block; padding:10px 16px; background:#111827; color:#fff; text-decoration:none; border-radius:8px;">
            Set a new password
          </a>
        </p>
        <p>This single-use link expires in 30 minutes.</p>
        <p style="font-size: 12px; color: #6b7280;">
          If you did not request this, ignore the email. Your password has not changed.
        </p>
      </div>
    `.trim(),
  };
}
