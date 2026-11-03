import { NextResponse } from "next/server";

import { verifyCsrfToken } from "@/server/auth/csrf";
import { writeAuditEvent } from "@/server/auth/audit";
import { AuthError, requireAdminApi } from "@/server/auth/require-admin";
import type { CurrentSession } from "@/server/auth/sessions";
import { getAdminPool } from "@/server/db/pools";
import { ImageUploadError, type UploadCategory, savePublicImage } from "@/server/storage/local";
import { isSameOrigin } from "@/server/security/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_MULTIPART_BYTES = 6 * 1024 * 1024;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) {
    return json({ ok: false, message: "Request rejected." }, 403);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
    return json({ ok: false, message: "Image is too large." }, 413);
  }

  let session: CurrentSession;
  try {
    session = await requireAdminApi();
  } catch (error) {
    if (error instanceof AuthError) return json({ ok: false, message: "Unauthorised." }, 401);
    throw error;
  }

  if (!verifyCsrfToken(request.headers.get("x-csrf-token"), session.csrfToken)) {
    return json({ ok: false, message: "Invalid request token." }, 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return json({ ok: false, message: "Unsupported request format." }, 415);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, message: "Invalid upload." }, 400);
  }

  const file = form.get("file");
  const alt = String(form.get("alt") ?? "").trim();
  const category = String(form.get("category") ?? "");

  if (!(file instanceof File)) {
    return json({ ok: false, message: "Choose an image to upload." }, 400);
  }
  if (category !== "packages" && category !== "destinations") {
    return json({ ok: false, message: "Invalid upload category." }, 400);
  }
  if (alt.length < 1 || alt.length > 200) {
    return json({ ok: false, message: "Alt text is required." }, 400);
  }

  try {
    const result = await savePublicImage(file, category as UploadCategory);
    await writeAuditEvent(getAdminPool(), {
      actorId: session.admin.id,
      action: "image.uploaded",
      entityType: category,
      entityId: null,
      ipHash: null,
      userAgentHash: null,
      metadata: { width: result.width, height: result.height },
    });
    return json({ ok: true, url: result.url, alt });
  } catch (error) {
    if (error instanceof ImageUploadError) {
      if (error.code === "too_large") {
        return json({ ok: false, message: "Image is too large." }, 413);
      }
      if (error.code === "storage") {
        return json({ ok: false, message: "Image could not be stored." }, 500);
      }
      return json({ ok: false, message: "Use a JPEG, PNG or WebP image." }, 400);
    }
    return json({ ok: false, message: "Image upload failed." }, 500);
  }
}
