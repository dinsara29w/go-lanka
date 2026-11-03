import { NextResponse } from "next/server";

import { strings } from "@/content/strings";
import { bookingRequestSchema } from "@/lib/validation/booking";
import { getRequestMetadata, isSameOrigin } from "@/server/security/request";
import { BodyTooLargeError, InvalidJsonError, readJsonBody } from "@/server/security/body";
import { getLogger } from "@/server/security/logger";
import { BookingError, submitBookingRequest } from "@/server/services/bookings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) {
    return json({ ok: false, message: strings.booking.api.rejected }, 403);
  }

  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return json({ ok: false, message: strings.booking.api.unsupported }, 415);
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 32 * 1024);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return json({ ok: false, message: strings.booking.api.tooLarge }, 413);
    }
    if (error instanceof InvalidJsonError) {
      return json({ ok: false, message: strings.booking.api.invalid }, 400);
    }
    return json({ ok: false, message: strings.booking.api.invalid }, 400);
  }

  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, message: strings.booking.api.invalid }, 400);
  }

  const metadata = getRequestMetadata(request);

  try {
    const result = await submitBookingRequest({
      values: parsed.data,
      ip: metadata.ip,
      ipHash: metadata.ipHash,
      userAgentHash: metadata.userAgentHash,
      requestId: metadata.requestId,
    });

    return json({ ok: true, reference: result.reference });
  } catch (error) {
    if (error instanceof BookingError) {
      getLogger().warn(
        {
          event: "booking_request_rejected",
          requestId: metadata.requestId,
          code: error.code,
          ipHash: metadata.ipHash,
        },
        "booking_request_rejected",
      );

      if (error.code === "rate_limited") {
        return json({ ok: false, message: strings.booking.api.rateLimited }, 429);
      }
      if (error.code === "verification_failed") {
        return json({ ok: false, message: strings.booking.api.verificationFailed }, 400);
      }
      if (error.code === "unavailable") {
        return json({ ok: false, message: strings.booking.api.unavailable }, 409);
      }
      return json({ ok: false, message: strings.booking.api.genericError }, 503);
    }

    getLogger().error(
      { event: "booking_request_failed", requestId: metadata.requestId, ipHash: metadata.ipHash },
      "booking_request_failed",
    );
    return json({ ok: false, message: strings.booking.api.genericError }, 500);
  }
}
