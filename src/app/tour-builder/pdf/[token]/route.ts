import { readFile } from "node:fs/promises";

import { getPublicPool } from "@/server/db/pools";
import { hashToken } from "@/server/security/request";
import { privateDocumentPath } from "@/server/storage/local";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 20 || token.length > 200) {
    return new Response("Not found", { status: 404 });
  }

  const result = await getPublicPool().query<{ file_path: string }>(
    "SELECT file_path FROM get_tour_document($1::text)",
    [hashToken(token)],
  );
  const row = result.rows[0];
  if (!row) return new Response("Not found", { status: 404 });

  const resolved = privateDocumentPath(row.file_path);
  if (!resolved) return new Response("Not found", { status: 404 });

  try {
    const file = await readFile(resolved);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="go-lanka-quotation.pdf"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
