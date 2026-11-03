import { readFile } from "node:fs/promises";

import { requireAdminApi } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";
import { privateMediaPath } from "@/server/storage/local";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const result = await getAdminPool().query<{ image_path: string }>(
    "SELECT image_path FROM photo_submissions WHERE id = $1::uuid",
    [id],
  );
  const row = result.rows[0];
  if (!row) return new Response("Not found", { status: 404 });

  const resolved = privateMediaPath(row.image_path);
  if (!resolved) return new Response("Not found", { status: 404 });

  try {
    const file = await readFile(resolved);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
