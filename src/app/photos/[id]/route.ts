import { readFile } from "node:fs/promises";

import { getApprovedPhotoPath } from "@/server/repositories/photos";
import { privateMediaPath } from "@/server/storage/local";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const photo = await getApprovedPhotoPath(id);
  if (!photo) return new Response("Not found", { status: 404 });

  const resolved = privateMediaPath(photo.imagePath);
  if (!resolved) return new Response("Not found", { status: 404 });

  try {
    const file = await readFile(resolved);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(file.byteLength),
        // Approved photos are public and immutable per id. Caching them lets
        // the browser and image optimizer reuse a downloaded photo instead of
        // refetching megabytes on every visit. Moderation changes reach repeat
        // visitors within a day.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
