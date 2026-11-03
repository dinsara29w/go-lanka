import { NextResponse } from "next/server";

import { strings } from "@/content/strings";
import { quoteRequestSchema } from "@/lib/validation/tour-builder";
import { QuoteError, submitQuoteContact } from "@/server/services/quotes";
import { BodyTooLargeError, readJsonBody } from "@/server/security/body";
import { getLogger } from "@/server/security/logger";
import { getRequestMetadata, isSameOrigin } from "@/server/security/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) {
    return json({ ok: false, message: strings.tourBuilder.api.rejected }, 403);
  }

  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return json({ ok: false, message: strings.tourBuilder.api.unsupported }, 415);
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 24 * 1024);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return json({ ok: false, message: strings.tourBuilder.api.tooLarge }, 413);
    }
    return json({ ok: false, message: strings.tourBuilder.api.invalid }, 400);
  }

  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, message: strings.tourBuilder.api.invalid }, 400);
  }

  const metadata = getRequestMetadata(request);

  try {
    const result = await submitQuoteContact({
      values: parsed.data,
      ip: metadata.ip,
      ipHash: metadata.ipHash,
      userAgentHash: metadata.userAgentHash,
      requestId: metadata.requestId,
    });
    return json({ ok: true, reference: result.reference });
  } catch (error) {
    if (error instanceof QuoteError) {
      getLogger().warn(
        { event: "quote_request_rejected", requestId: metadata.requestId, code: error.code },
        "quote_request_rejected",
      );
      if (error.code === "rate_limited") {
        return json({ ok: false, message: strings.tourBuilder.api.rateLimited }, 429);
      }
      if (error.code === "verification_failed") {
        return json({ ok: false, message: strings.tourBuilder.api.verificationFailed }, 400);
      }
      if (error.code === "unavailable") {
        return json({ ok: false, message: strings.tourBuilder.quoteError }, 409);
      }
      return json({ ok: false, message: strings.tourBuilder.api.invalid }, 400);
    }

    getLogger().error(
      { event: "quote_request_failed", requestId: metadata.requestId },
      "quote_request_failed",
    );
    return json({ ok: false, message: strings.tourBuilder.quoteError }, 500);
  }
}
