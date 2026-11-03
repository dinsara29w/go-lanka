import { NextResponse } from "next/server";

import { getAdminPool } from "@/server/db/pools";
import { getServerEnv } from "@/server/env";
import { getLogger } from "@/server/security/logger";
import { safeEqual } from "@/server/security/request";
import { deletePrivateDocument } from "@/server/storage/local";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BATCH_SIZE = 500;
const MAX_BATCHES = 10;

export async function POST(request: Request) {
  const env = getServerEnv();
  const authorisation = request.headers.get("authorization") ?? "";
  if (!safeEqual(authorisation, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const pool = getAdminPool();

  try {
    let documentsDeleted = 0;
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const result = await pool.query<{ file_path: string }>(
        "SELECT cleanup_expired_documents($1) AS file_path",
        [BATCH_SIZE],
      );

      for (const row of result.rows) {
        await deletePrivateDocument(row.file_path);
      }
      documentsDeleted += result.rows.length;
      if (result.rows.length < BATCH_SIZE) break;
    }

    const cleanup = await pool.query<{ result: Record<string, number> }>(
      "SELECT cleanup_expired() AS result",
    );

    getLogger().info(
      { event: "retention_cleanup", documentsDeleted, ...cleanup.rows[0]?.result },
      "retention_cleanup",
    );

    return NextResponse.json(
      {
        ok: true,
        documentsDeleted,
        database: cleanup.rows[0]?.result ?? {},
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    getLogger().error(
      { err: error, event: "retention_cleanup_failed" },
      "retention_cleanup_failed",
    );
    return NextResponse.json(
      { ok: false, message: "Retention cleanup failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
