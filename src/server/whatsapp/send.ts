import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { isLocalSiteUrl } from "@/lib/site";
import { getServerEnv } from "@/server/env";
import { getLogger } from "@/server/security/logger";

export type WhatsAppMessage = {
  to: string;
  text: string;
  /** Approved Meta template name. Omit to send a free-form text message. */
  templateName?: string;
  /** Values for the template body, in order. */
  templateParams?: string[];
};

export function normalizeWhatsAppNumber(value: string): string | null {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 7 || digits.length > 20) return null;
  return digits;
}

function bodyFor(message: WhatsAppMessage, to: string, templateLanguage: string) {
  if (message.templateName) {
    const parameters = (message.templateParams ?? []).map((value) => ({
      type: "text" as const,
      text: value,
    }));
    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: message.templateName,
        language: { code: templateLanguage },
        ...(parameters.length > 0 ? { components: [{ type: "body" as const, parameters }] } : {}),
      },
    };
  }

  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: message.text, preview_url: false },
  };
}

export async function sendWhatsApp(
  message: WhatsAppMessage,
  context: { requestId: string },
): Promise<void> {
  const env = getServerEnv();
  const to = normalizeWhatsAppNumber(message.to);
  if (!to) throw new Error("Invalid WhatsApp recipient");

  if (env.WHATSAPP_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
    const response = await fetch(
      `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyFor(message, to, env.WHATSAPP_TEMPLATE_LANGUAGE)),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      getLogger().error(
        {
          event: "whatsapp_delivery_failed",
          requestId: context.requestId,
          status: response.status,
        },
        "whatsapp_delivery_failed",
      );
      throw new Error("WhatsApp delivery failed");
    }

    return;
  }

  if (env.NODE_ENV === "production" && !isLocalSiteUrl()) {
    throw new Error("WhatsApp provider is not configured");
  }

  // Local development outbox. Messages contain PII, so they stay under the
  // gitignored .data directory and are never logged.
  const outbox = path.join(process.cwd(), ".data", "whatsapp");
  await mkdir(outbox, { recursive: true });
  const id = randomUUID();
  await writeFile(
    path.join(outbox, `${new Date().toISOString().replaceAll(":", "-")}-${id}.json`),
    JSON.stringify({ ...message, to }, null, 2),
    { encoding: "utf8", mode: 0o600 },
  );

  getLogger().info(
    { event: "whatsapp_dev_outbox", requestId: context.requestId },
    "whatsapp_dev_outbox",
  );
}
