import "server-only";

import { SITE_NAME } from "@/lib/site";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildContactNotification(input: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  requestId: string;
}): { subject: string; html: string; text: string } {
  const name = escapeHtml(input.name);
  const email = escapeHtml(input.email);
  const phone = input.phone ? escapeHtml(input.phone) : null;
  const message = escapeHtml(input.message);

  return {
    subject: "New website contact enquiry",
    text: [
      `New contact enquiry for ${SITE_NAME}`,
      "",
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      `Phone: ${input.phone || "Not provided"}`,
      "",
      "Message:",
      input.message,
      "",
      `Request ID: ${input.requestId}`,
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1f2937;">
        <h1 style="font-size: 20px;">New contact enquiry</h1>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone ?? "Not provided"}</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="white-space: pre-wrap;">${message}</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280;">Request ID: ${escapeHtml(input.requestId)}</p>
      </div>
    `.trim(),
  };
}
