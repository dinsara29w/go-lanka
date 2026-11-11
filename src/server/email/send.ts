import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resend } from "resend";

import { isLocalSiteUrl } from "@/lib/site";
import { getServerEnv } from "@/server/env";
import { getLogger } from "@/server/security/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

let client: Resend | undefined;

export async function sendEmail(
  message: EmailMessage,
  context: { requestId: string },
): Promise<void> {
  const env = getServerEnv();
  const from = env.EMAIL_FROM;

  if (env.RESEND_API_KEY && from) {
    client ??= new Resend(env.RESEND_API_KEY);
    const result = await client.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
    });

    if (result.error) {
      getLogger().error(
        { event: "email_delivery_failed", requestId: context.requestId, provider: "resend" },
        "email_delivery_failed",
      );
      throw new Error("Email delivery failed");
    }

    return;
  }

  if (env.NODE_ENV === "production" && !isLocalSiteUrl()) {
    throw new Error("Email provider is not configured");
  }

  // Local development outbox. This contains PII, so it stays under the
  // gitignored .data directory and is never logged.
  const outbox = path.join(process.cwd(), ".data", "mail");
  await mkdir(outbox, { recursive: true });
  const id = randomUUID();
  await writeFile(
    path.join(outbox, `${new Date().toISOString().replaceAll(":", "-")}-${id}.json`),
    JSON.stringify(
      {
        from: from ?? "Go Lanka <dev@localhost>",
        ...message,
      },
      null,
      2,
    ),
    { encoding: "utf8", mode: 0o600 },
  );

  getLogger().info({ event: "email_dev_outbox", requestId: context.requestId }, "email_dev_outbox");
}
