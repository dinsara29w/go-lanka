import { NextResponse } from "next/server";

import { strings } from "@/content/strings";
import { contactRequestSchema } from "@/lib/validation/contact";
import { getRequestMetadata, isSameOrigin } from "@/server/security/request";
import { BodyTooLargeError, InvalidJsonError, readJsonBody } from "@/server/security/body";
import { getLogger } from "@/server/security/logger";
import { ContactError, submitContactRequest } from "@/server/services/contact";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) {
    return json({ ok: false, message: strings.contact.api.rejected }, 403);
  }

  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return json({ ok: false, message: strings.contact.api.unsupported }, 415);
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 16 * 1024);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return json({ ok: false, message: strings.contact.api.tooLarge }, 413);
    }
    if (error instanceof InvalidJsonError) {
      return json({ ok: false, message: strings.contact.api.invalid }, 400);
    }
    return json({ ok: false, message: strings.contact.api.invalid }, 400);
  }

  const parsed = contactRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, message: strings.contact.api.checkForm }, 400);
  }

  const metadata = getRequestMetadata(request);

  try {
    await submitContactRequest({
      values: parsed.data,
      ip: metadata.ip,
      ipHash: metadata.ipHash,
      userAgentHash: metadata.userAgentHash,
      requestId: metadata.requestId,
    });

    return json({ ok: true });
  } catch (error) {
    if (error instanceof ContactError) {
      getLogger().warn(
        {
          event: "contact_request_rejected",
          requestId: metadata.requestId,
          code: error.code,
          ipHash: metadata.ipHash,
        },
        "contact_request_rejected",
      );

      if (error.code === "rate_limited") {
        return json({ ok: false, message: strings.contact.api.rateLimited }, 429);
      }
      if (error.code === "verification_failed") {
        return json({ ok: false, message: strings.contact.api.verificationFailed }, 400);
      }
      return json({ ok: false, message: strings.contact.api.deliveryFailed }, 503);
    }

    getLogger().error(
      { event: "contact_request_failed", requestId: metadata.requestId, ipHash: metadata.ipHash },
      "contact_request_failed",
    );
    return json({ ok: false, message: strings.contact.api.genericError }, 500);
  }
}
