import "server-only";

import type { ExchangeRates } from "@/lib/currency";
import { getPublicPool } from "@/server/db/pools";

export async function getLatestExchangeRates(): Promise<ExchangeRates | null> {
  const result = await getPublicPool().query<{
    usd: string;
    eur: string;
    gbp: string;
    fetched_at: Date;
  }>(
    `SELECT usd, eur, gbp, fetched_at
     FROM exchange_rates
     ORDER BY fetched_at DESC
     LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    usd: Number(row.usd),
    eur: Number(row.eur),
    gbp: Number(row.gbp),
    fetchedAt: row.fetched_at,
  };
}
