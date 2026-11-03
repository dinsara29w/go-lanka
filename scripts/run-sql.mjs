import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { Pool } from "pg";

try {
  loadEnvFile(".env.local");
} catch {
  // Deployment environments may inject variables directly.
}

const file = process.argv[2];
const databaseUrl = process.env.MIGRATION_DATABASE_URL;

if (!file) {
  console.error("Usage: node scripts/run-sql.mjs <sql-file>");
  process.exit(1);
}
if (!databaseUrl) {
  console.error("MIGRATION_DATABASE_URL is not set.");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  await pool.query(sql);
  console.log(`Applied ${file}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "SQL execution failed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
