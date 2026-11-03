import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminPool } from "@/server/db/pools";
import { getServerEnv } from "@/server/env";
import { getLogger } from "@/server/security/logger";
import { safeEqual } from "@/server/security/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const providerSchema = z.object({
  result: z.literal("success"),
  rates: z.object({
    USD: z.number().positive(),
    EUR: z.number().positive(),
    GBP: z.number().positive(),
  }),
});

const DEFAULT_PROVIDER_URL = "https://open.er-api.com/v6/latest/LKR";

export async function POST(request: Request) {
  const env = getServerEnv();
  const authorisation = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (!safeEqual(authorisation, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const url = new URL(env.EXCHANGE_RATE_API_URL ?? DEFAULT_PROVIDER_URL);
    if (env.EXCHANGE_RATE_API_KEY) {
      url.searchParams.set("api_key", env.EXCHANGE_RATE_API_KEY);
    }

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);

    const parsed = providerSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Provider response failed validation");

    const lkrPerUsd = 1 / parsed.data.rates.USD;
    const lkrPerEur = 1 / parsed.data.rates.EUR;
    const lkrPerGbp = 1 / parsed.data.rates.GBP;

    await getAdminPool().query(
      `INSERT INTO exchange_rates (base, usd, eur, gbp, fetched_at)
       VALUES ('LKR', $1, $2, $3, now())`,
      [lkrPerUsd, lkrPerEur, lkrPerGbp],
    );

    getLogger().info({ event: "exchange_rates_updated" }, "exchange_rates_updated");
    return NextResponse.json(
      { ok: true, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    getLogger().error(
      { err: error, event: "exchange_rates_update_failed" },
      "exchange_rates_update_failed",
    );
    return NextResponse.json(
      { ok: false, message: "Exchange-rate refresh failed." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
