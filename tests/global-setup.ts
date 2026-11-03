import { loadEnvFile } from "node:process";

import { Pool } from "pg";

export default async function globalSetup() {
  try {
    loadEnvFile(".env.local");
  } catch {
    // CI can provide environment variables directly.
  }

  const databaseUrl = process.env.MIGRATION_DATABASE_URL;
  if (!databaseUrl) return;

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await pool.query("DELETE FROM rate_limits");
    await pool.query(
      `INSERT INTO exchange_rates (base, usd, eur, gbp, fetched_at)
       SELECT 'LKR', 300, 325, 380, now()
       WHERE NOT EXISTS (SELECT 1 FROM exchange_rates)`,
    );
  } finally {
    await pool.end();
  }
}
