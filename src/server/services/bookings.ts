import "server-only";

import { z } from "zod";

import type { BookingRequest } from "@/lib/validation/booking";
import { isLocalSiteUrl } from "@/lib/site";
import { generateBookingReference } from "@/server/bookings/reference";
import { getPublicPool } from "@/server/db/pools";
import { buildAdminBookingEmail, buildCustomerBookingEmail } from "@/server/email/booking";
import { sendEmail } from "@/server/email/send";
import { getServerEnv } from "@/server/env";
import { getSiteSettings } from "@/server/repositories/site-settings";
import { getLogger } from "@/server/security/logger";
import { buildRateLimitKey, consumeRateLimit } from "@/server/security/rate-limit";
import { hashValue } from "@/server/security/request";
import { verifyTurnstile } from "@/server/security/turnstile";

export class BookingError extends Error {
  constructor(
    readonly code: "rate_limited" | "verification_failed" | "unavailable" | "delivery_failed",
    readonly status: number,
  ) {
    super(code);
    this.name = "BookingError";
  }
}

export async function submitBookingRequest(input: {
  values: BookingRequest;
  ip: string;
  ipHash: string;
  userAgentHash: string;
  requestId: string;
}): Promise<{ reference: string | null }> {
  const pool = getPublicPool();
  const emailKey = buildRateLimitKey(
    "booking-email",
    hashValue(input.values.email, "booking-email"),
  );
  const ipKey = buildRateLimitKey("booking-ip", input.ipHash);

  const [ipAllowed, emailAllowed] = await Promise.all([
    consumeRateLimit(pool, { key: ipKey, limit: 5, windowSeconds: 60 * 60 }),
    consumeRateLimit(pool, { key: emailKey, limit: 3, windowSeconds: 60 * 60 }),
  ]);

  if (!ipAllowed || !emailAllowed) {
    throw new BookingError("rate_limited", 429);
  }

  if (input.values.website && input.values.website.trim() !== "") {
    getLogger().warn({ event: "booking_honeypot", requestId: input.requestId }, "booking_honeypot");
    return { reference: null };
  }

  const verified = await verifyTurnstile({
    token: input.values.turnstileToken,
    ip: input.ip,
    action: "booking",
  });
  if (!verified) {
    throw new BookingError("verification_failed", 400);
  }

  const packageResult = await pool.query<{ id: string; title: string }>(
    "SELECT id, title FROM packages WHERE id = $1::uuid AND is_published = true",
    [input.values.packageId],
  );
  const pkg = packageResult.rows[0];
  if (!pkg) throw new BookingError("unavailable", 409);

  let created:
    { booking_id: string; booking_reference: string; booking_status: string } | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reference = generateBookingReference();
    try {
      const result = await pool.query<{
        booking_id: string;
        booking_reference: string;
        booking_status: string;
      }>(
        `SELECT booking_id, booking_reference, booking_status
         FROM create_booking(
           $1::text, $2::uuid, 'package', $3::text, $4::text, $5::text,
           $6::text, $7::date, $8::int, $9::int, $10::text, NULL::jsonb,
           'LKR', $11::text
         )`,
        [
          reference,
          input.values.packageId,
          input.values.name,
          input.values.email,
          input.values.phone,
          input.values.country,
          input.values.travelDate,
          input.values.adults,
          input.values.children,
          input.values.message || null,
          input.values.idempotencyKey,
        ],
      );
      created = result.rows[0];
      break;
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      const constraint = (error as { constraint?: string } | null)?.constraint;
      if (code === "23505" && constraint === "bookings_reference_unique") continue;
      if (code === "P0001") {
        throw new BookingError("unavailable", 409);
      }
      throw error;
    }
  }

  if (!created) {
    throw new BookingError("unavailable", 409);
  }

  const emailData = {
    reference: created.booking_reference,
    packageTitle: pkg.title,
    travelDate: input.values.travelDate,
    adults: input.values.adults,
    children: input.values.children,
    name: input.values.name,
    email: input.values.email,
    phone: input.values.phone,
    country: input.values.country,
    message: input.values.message,
    bookingId: created.booking_id,
  };

  const env = getServerEnv();
  const settings = await getSiteSettings();
  const adminCandidate = env.ADMIN_NOTIFICATION_EMAIL ?? settings?.contactEmail ?? null;
  const adminRecipient =
    adminCandidate === null
      ? null
      : (z.string().trim().email().max(320).safeParse(adminCandidate).data ?? null);

  const customerTemplate = buildCustomerBookingEmail(emailData);
  const adminTemplate = buildAdminBookingEmail(emailData);

  const deliveries: Promise<void>[] = [
    sendEmail(
      {
        to: input.values.email,
        subject: customerTemplate.subject,
        html: customerTemplate.html,
        text: customerTemplate.text,
      },
      { requestId: input.requestId },
    ),
  ];

  if (adminRecipient || env.NODE_ENV !== "production" || isLocalSiteUrl()) {
    deliveries.push(
      sendEmail(
        {
          to: adminRecipient ?? "dev@localhost",
          subject: adminTemplate.subject,
          html: adminTemplate.html,
          text: adminTemplate.text,
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
        { event: "booking_email_failed", requestId: input.requestId },
        "booking_email_failed",
      );
    }
  }

  getLogger().info(
    {
      event: "booking_created",
      requestId: input.requestId,
      reference: created.booking_reference,
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
    },
    "booking_created",
  );

  return { reference: created.booking_reference };
}
