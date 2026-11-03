import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";

import { Pool } from "pg";

try {
  loadEnvFile(".env.local");
} catch {
  // Deployment environments may inject variables directly.
}

const email = process.argv
  .find((arg) => arg.includes("@"))
  ?.trim()
  .toLowerCase();
const databaseUrl = process.env.MIGRATION_DATABASE_URL;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const hashSecret = process.env.IP_HASH_SECRET;

if (!email) {
  console.error("Usage: npm run invite:admin -- owner@example.com");
  process.exit(1);
}
if (!databaseUrl || !hashSecret) {
  console.error("Database or IP_HASH_SECRET is not configured.");
  process.exit(1);
}

const tokenSecret = hashSecret;
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

function tokenHash(token: string): string {
  return createHmac("sha256", tokenSecret).update(`token:${token}`).digest("hex");
}

async function main() {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM admin_users WHERE lower(email) = $1 AND is_active = true",
    [email],
  );
  const admin = result.rows[0];
  if (!admin) throw new Error("No active admin account found for that email.");

  const token = randomBytes(32).toString("base64url");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE admin_password_tokens SET used_at = now()
       WHERE admin_user_id = $1 AND purpose = 'invite' AND used_at IS NULL`,
      [admin.id],
    );
    await client.query(
      `INSERT INTO admin_password_tokens (admin_user_id, token_hash, purpose, expires_at)
       VALUES ($1, $2, 'invite', now() + interval '24 hours')`,
      [admin.id, tokenHash(token)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const inviteUrl = new URL(`/admin/setup?token=${encodeURIComponent(token)}`, siteUrl).toString();
  const directory = path.join(process.cwd(), ".data");
  const file = path.join(directory, "admin-invite.txt");
  await mkdir(directory, { recursive: true });
  await writeFile(file, `${inviteUrl}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(`Invite written to ${file} (expires in 24 hours).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Invite generation failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
