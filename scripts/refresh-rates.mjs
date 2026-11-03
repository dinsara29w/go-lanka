import { loadEnvFile } from "node:process";

import { Pool } from "pg";

try {
  loadEnvFile(".env.local");
} catch {
  // Deployment environments can provide variables directly.
}

const databaseUrl = process.env.MIGRATION_DATABASE_URL;
const providerUrl =
  process.env.EXCHANGE_RATE_API_URL?.trim() || "https://open.er-api.com/v6/latest/LKR";
const apiKey = process.env.EXCHANGE_RATE_API_KEY;

if (!databaseUrl) {
  console.error("MIGRATION_DATABASE_URL is not set.");
  process.exit(1);
}

const url = new URL(providerUrl);
if (apiKey) url.searchParams.set("api_key", apiKey);

const response = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
if (!response.ok) {
  console.error(`Exchange provider returned ${response.status}.`);
  process.exit(1);
}

const payload = await response.json();
const rates = payload?.rates;
if (
  payload?.result !== "success" ||
  typeof rates?.USD !== "number" ||
  typeof rates?.EUR !== "number" ||
  typeof rates?.GBP !== "number"
) {
  console.error("Exchange provider response was not valid.");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  await pool.query(
    `INSERT INTO exchange_rates (base, usd, eur, gbp, fetched_at)
     VALUES ('LKR', $1, $2, $3, now())`,
    [1 / rates.USD, 1 / rates.EUR, 1 / rates.GBP],
  );
  console.log("Exchange rates refreshed.");
} finally {
  await pool.end();
}
