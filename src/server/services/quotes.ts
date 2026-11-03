import "server-only";

import { z } from "zod";

import { isLocalSiteUrl, getSiteUrl } from "@/lib/site";
import type { QuoteRequest } from "@/lib/validation/tour-builder";
import { getPublicPool } from "@/server/db/pools";
import { buildAdminQuoteNotification } from "@/server/email/quotes";
import { sendEmail } from "@/server/email/send";
import { getServerEnv } from "@/server/env";
import { getTourBuilderRates } from "@/server/repositories/tour-builder-rates";
import { getSiteSettings } from "@/server/repositories/site-settings";
import { getLogger } from "@/server/security/logger";
import { buildRateLimitKey, consumeRateLimit } from "@/server/security/rate-limit";
import { hashValue } from "@/server/security/request";
import { verifyTurnstile } from "@/server/security/turnstile";
import { sendWhatsApp } from "@/server/whatsapp/send";

export class QuoteError extends Error {
  constructor(
    readonly code:
      | "rate_limited"
      | "verification_failed"
      | "unavailable"
      | "invalid"
      | "not_found",
    readonly status: number,
  ) {
    super(code);
    this.name = "QuoteError";
  }
}

type ContactResult = {
  quote_id: string;
  quote_reference: string;
  newly_submitted: boolean;
};

export async function submitQuoteContact(input: {
  values: QuoteRequest;
  ip: string;
  ipHash: string;
  userAgentHash: string;
  requestId: string;
}): Promise<{ reference: string }> {
  const pool = getPublicPool();
  const [ipAllowed, emailAllowed] = await Promise.all([
    consumeRateLimit(pool, {
      key: buildRateLimitKey("quote-ip", input.ipHash),
      limit: 5,
      windowSeconds: 60 * 60,
    }),
    consumeRateLimit(pool, {
      key: buildRateLimitKey("quote-email", hashValue(input.values.email, "quote-email")),
      limit: 3,
      windowSeconds: 60 * 60,
    }),
  ]);
  if (!ipAllowed || !emailAllowed) throw new QuoteError("rate_limited", 429);

  const verified = await verifyTurnstile({
    token: input.values.turnstileToken,
    ip: input.ip,
    action: "quote",
  });
  if (!verified) throw new QuoteError("verification_failed", 400);

  let result: ContactResult | undefined;
  try {
    const response = await pool.query<ContactResult>(
      `SELECT quote_id, quote_reference, newly_submitted
       FROM submit_tour_quote_contact(
         $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::date, $8::text, $9::text
       )`,
      [
        input.values.sessionId,
        input.values.reference,
        input.values.name,
        input.values.email,
        input.values.phone,
        input.values.country,
        input.values.travelDate,
        input.values.message ?? null,
        input.values.idempotencyKey,
      ],
    );
    result = response.rows[0];
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    const message = (error as { message?: string } | null)?.message ?? "";
    if (code === "P0001") {
      if (message.includes("quote_not_found")) throw new QuoteError("not_found", 409);
      throw new QuoteError("invalid", 400);
    }
    throw error;
  }

  if (!result) throw new QuoteError("unavailable", 409);

  if (result.newly_submitted) {
    await notifyAdmin({
      quoteId: result.quote_id,
      reference: result.quote_reference,
      values: input.values,
      requestId: input.requestId,
    });
  }

  getLogger().info(
    {
      event: "quote_contact_submitted",
      requestId: input.requestId,
      reference: result.quote_reference,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
      notified: result.newly_submitted,
    },
    "quote_contact_submitted",
  );

  return { reference: result.quote_reference };
}

async function notifyAdmin(input: {
  quoteId: string;
  reference: string;
  values: QuoteRequest;
  requestId: string;
}): Promise<void> {
  const env = getServerEnv();
  const [settings, rates] = await Promise.all([
    getSiteSettings(),
    getTourBuilderRates(),
  ]);
  const adminUrl = new URL(`/admin/quotes/${input.quoteId}`, getSiteUrl()).toString();
  const adminWhatsApp = rates.adminWhatsAppNumber ?? settings?.whatsappNumber ?? null;
  const adminEmailCandidate = env.ADMIN_NOTIFICATION_EMAIL ?? settings?.contactEmail ?? null;
  const adminEmail =
    adminEmailCandidate === null
      ? null
      : (z.string().trim().email().max(320).safeParse(adminEmailCandidate).data ?? null);

  const email = buildAdminQuoteNotification({
    reference: input.reference,
    quoteId: input.quoteId,
    name: input.values.name,
    email: input.values.email,
    phone: input.values.phone,
    country: input.values.country,
    travelDate: input.values.travelDate,
    message: input.values.message,
  });

  const deliveries: Promise<void>[] = [];

  if (adminWhatsApp) {
    deliveries.push(
      sendWhatsApp(
        {
          to: adminWhatsApp,
          text: `New tour quotation ${input.reference} from ${input.values.name} (${input.values.phone}, ${input.values.email}). Review: ${adminUrl}`,
          templateName: env.WHATSAPP_ADMIN_TEMPLATE,
          templateParams: [input.reference, input.values.name, adminUrl],
        },
        { requestId: input.requestId },
      ),
    );
  }

  if (adminEmail || env.NODE_ENV !== "production" || isLocalSiteUrl()) {
    deliveries.push(
      sendEmail(
        {
          to: adminEmail ?? "dev@localhost",
          subject: email.subject,
          html: email.html,
          text: email.text,
          replyTo: input.values.email,
        },
        { requestId: input.requestId },
      ),
    );
  }

  const results = await Promise.allSettled(deliveries);
  for (const result of results) {
    if (result.status === "rejected") {
      getLogger().error(
        { event: "quote_admin_notification_failed", requestId: input.requestId },
        "quote_admin_notification_failed",
      );
    }
  }
}
