import { NextResponse } from "next/server";

import { strings } from "@/content/strings";
import { tourBuilderRequestSchema } from "@/lib/validation/tour-builder";
import { getPublicPool } from "@/server/db/pools";
import { getLogger } from "@/server/security/logger";
import { buildRateLimitKey, consumeRateLimit } from "@/server/security/rate-limit";
import { getRequestMetadata, isSameOrigin } from "@/server/security/request";
import { verifyTurnstile } from "@/server/security/turnstile";
import { readJsonBody, BodyTooLargeError, InvalidJsonError } from "@/server/security/body";
import { generateTourBuilderResult, TourBuilderError } from "@/server/ai/tour-builder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
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
    if (error instanceof InvalidJsonError) {
      return json({ ok: false, message: strings.tourBuilder.api.invalid }, 400);
    }
    return json({ ok: false, message: strings.tourBuilder.api.invalid }, 400);
  }

  const parsed = tourBuilderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, message: strings.tourBuilder.api.invalid }, 400);
  }

  const metadata = getRequestMetadata(request);
  const pool = getPublicPool();
  const [ipAllowed, globalAllowed] = await Promise.all([
    consumeRateLimit(pool, {
      key: buildRateLimitKey("tour-builder-ip", metadata.ipHash),
      limit: 5,
      windowSeconds: 86_400,
    }),
    consumeRateLimit(pool, {
      key: "tour-builder-global",
      limit: 100,
      windowSeconds: 86_400,
    }),
  ]);
  if (!ipAllowed || !globalAllowed) {
    return json({ ok: false, message: strings.tourBuilder.api.rateLimited }, 429);
  }

  const verified = await verifyTurnstile({
    token: parsed.data.turnstileToken,
    ip: metadata.ip,
    action: "tour-builder",
  });
  if (!verified) {
    return json({ ok: false, message: strings.tourBuilder.api.verificationFailed }, 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const heartbeat = setInterval(() => {
        try {
          send({ type: "progress", stage: strings.tourBuilder.building });
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      try {
        send({ type: "progress", stage: strings.tourBuilder.progressStarting });
        const result = await generateTourBuilderResult({
          quiz: parsed.data,
          ipHash: metadata.ipHash,
          requestId: metadata.requestId,
          onProgress: (stage) => send({ type: "progress", stage }),
        });
        send({ type: "result", result });
      } catch (error) {
        if (error instanceof TourBuilderError) {
          getLogger().warn(
            {
              event: "tour_builder_failed",
              requestId: metadata.requestId,
              code: error.code,
            },
            "tour_builder_failed",
          );
          if (error.code === "rate_limited") {
            send({ type: "fallback", message: strings.tourBuilder.api.rateLimited });
          } else if (error.code === "invalid_input") {
            send({ type: "fallback", message: strings.tourBuilder.api.invalid });
          } else {
            send({ type: "fallback", message: strings.tourBuilder.fallback });
          }
        } else {
          getLogger().error(
            { event: "tour_builder_unexpected", requestId: metadata.requestId },
            "tour_builder_unexpected",
          );
          send({ type: "fallback", message: strings.tourBuilder.fallback });
        }
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
