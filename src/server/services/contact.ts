import "server-only";

import { z } from "zod";

import type { ContactRequest } from "@/lib/validation/contact";
import { buildContactNotification } from "@/server/email/templates";
import { sendEmail } from "@/server/email/send";
import { isLocalSiteUrl } from "@/lib/site";
import { getServerEnv } from "@/server/env";
import { getPublicPool } from "@/server/db/pools";
import { getSiteSettings } from "@/server/repositories/site-settings";
import { getLogger } from "@/server/security/logger";
import { buildRateLimitKey, consumeRateLimit } from "@/server/security/rate-limit";
import { hashValue } from "@/server/security/request";
import { verifyTurnstile } from "@/server/security/turnstile";

export class ContactError extends Error {
  constructor(
    readonly code: "rate_limited" | "verification_failed" | "delivery_failed" | "unavailable",
    readonly status: number,
  ) {
    super(code);
    this.name = "ContactError";
  }
}

export async function submitContactRequest(input: {
  values: ContactRequest;
  ip: string;
  ipHash: string;
  userAgentHash: string;
  requestId: string;
}): Promise<void> {
  const pool = getPublicPool();
  const emailKey = buildRateLimitKey(
    "contact-email",
    hashValue(input.values.email, "contact-email"),
  );
  const ipKey = buildRateLimitKey("contact-ip", input.ipHash);

  const [ipAllowed, emailAllowed] = await Promise.all([
    consumeRateLimit(pool, { key: ipKey, limit: 5, windowSeconds: 60 * 60 }),
    consumeRateLimit(pool, { key: emailKey, limit: 3, windowSeconds: 60 * 60 }),
  ]);

  if (!ipAllowed || !emailAllowed) {
    throw new ContactError("rate_limited", 429);
  }

  if (input.values.website && input.values.website.trim() !== "") {
    getLogger().warn({ event: "contact_honeypot", requestId: input.requestId }, "contact_honeypot");
    return;
  }

  const verified = await verifyTurnstile({
    token: input.values.turnstileToken,
    ip: input.ip,
    action: "contact",
  });

  if (!verified) {
    throw new ContactError("verification_failed", 400);
  }

  const env = getServerEnv();
  const settings = await getSiteSettings();
  const candidateRecipient = env.ADMIN_NOTIFICATION_EMAIL ?? settings?.contactEmail ?? null;
  const recipient =
    candidateRecipient === null
      ? null
      : (z.string().trim().email().max(320).safeParse(candidateRecipient).data ?? null);

  if (!recipient && env.NODE_ENV === "production" && !isLocalSiteUrl()) {
    throw new ContactError("unavailable", 503);
  }

  const template = buildContactNotification({
    name: input.values.name,
    email: input.values.email,
    phone: input.values.phone,
    message: input.values.message,
    requestId: input.requestId,
  });

  try {
    await sendEmail(
      {
        to: recipient ?? "dev@localhost",
        subject: template.subject,
        html: template.html,
        text: template.text,
        replyTo: input.values.email,
      },
      { requestId: input.requestId },
    );
  } catch {
    throw new ContactError("delivery_failed", 502);
  }

  getLogger().info(
    {
      event: "contact_submitted",
      requestId: input.requestId,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
    },
    "contact_submitted",
  );
}
