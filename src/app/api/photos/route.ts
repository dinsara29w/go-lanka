import { NextResponse } from "next/server";

import { strings } from "@/content/strings";
import { getPublicPool } from "@/server/db/pools";
import { getLogger } from "@/server/security/logger";
import { buildRateLimitKey, consumeRateLimit } from "@/server/security/rate-limit";
import { getRequestMetadata, isSameOrigin } from "@/server/security/request";
import { verifyTurnstile } from "@/server/security/turnstile";
import { ImageUploadError, deletePrivatePhoto, savePrivatePhoto } from "@/server/storage/local";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_MULTIPART_BYTES = 6 * 1024 * 1024;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) {
    return json({ ok: false, message: strings.photos.api.rejected }, 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return json({ ok: false, message: strings.photos.api.unsupported }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
    return json({ ok: false, message: strings.photos.api.tooLarge }, 413);
  }

  const metadata = getRequestMetadata(request);
  const pool = getPublicPool();
  const rateLimitKey = buildRateLimitKey("photo-upload", metadata.ipHash);
  const allowed = await consumeRateLimit(pool, {
    key: rateLimitKey,
    limit: 3,
    windowSeconds: 86_400,
  });
  if (!allowed) {
    return json({ ok: false, message: strings.photos.api.rateLimited }, 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, message: strings.photos.api.invalid }, 400);
  }

  if (String(form.get("website") ?? "").trim() !== "") {
    getLogger().warn({ event: "photo_honeypot", requestId: metadata.requestId }, "photo_honeypot");
    return json({ ok: true });
  }

  const file = form.get("file");
  const consent = String(form.get("consent") ?? "") === "on";
  const caption = String(form.get("caption") ?? "")
    .trim()
    .slice(0, 1000);
  const submitterName = String(form.get("submitterName") ?? "")
    .trim()
    .slice(0, 200);
  const packageId = String(form.get("packageId") ?? "").trim() || null;
  const turnstileToken = String(form.get("turnstileToken") ?? "");

  if (!(file instanceof File) || !consent) {
    return json({ ok: false, message: strings.photos.api.invalid }, 400);
  }
  if (packageId && !/^[0-9a-f-]{36}$/i.test(packageId)) {
    return json({ ok: false, message: strings.photos.api.invalid }, 400);
  }

  const verified = await verifyTurnstile({
    token: turnstileToken,
    ip: metadata.ip,
    action: "photos",
  });
  if (!verified) {
    return json({ ok: false, message: strings.photos.api.verificationFailed }, 400);
  }

  let savedPath: string | null = null;
  try {
    const saved = await savePrivatePhoto(file);
    savedPath = saved.path;

    const result = await pool.query<{ id: string }>(
      `SELECT submit_photo($1::text, $2::text, NULL, $3::text, true, $4::uuid) AS id`,
      [saved.path, caption || null, submitterName || null, packageId],
    );

    if (!result.rows[0]?.id) {
      await deletePrivatePhoto(saved.path);
      return json({ ok: false, message: strings.photos.api.genericError }, 500);
    }

    getLogger().info(
      { event: "photo_submitted", requestId: metadata.requestId, ipHash: metadata.ipHash },
      "photo_submitted",
    );
    return json({ ok: true });
  } catch (error) {
    if (savedPath) await deletePrivatePhoto(savedPath);
    if (error instanceof ImageUploadError) {
      if (error.code === "too_large") {
        return json({ ok: false, message: strings.photos.api.tooLarge }, 413);
      }
      return json({ ok: false, message: strings.photos.api.invalid }, 400);
    }
    getLogger().error(
      { event: "photo_submission_failed", requestId: metadata.requestId },
      "photo_submission_failed",
    );
    return json({ ok: false, message: strings.photos.api.genericError }, 500);
  }
}
