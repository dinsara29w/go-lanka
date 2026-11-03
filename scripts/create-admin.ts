import { createHmac, randomBytes } from "node:crypto";
import { loadEnvFile } from "node:process";

import { hash, type Algorithm } from "@node-rs/argon2";
import { Pool } from "pg";

try {
  loadEnvFile(".env.local");
} catch {
  // CI or deployment may provide environment variables directly.
}

const email = process.argv[2]?.trim().toLowerCase();
const databaseUrl = process.env.MIGRATION_DATABASE_URL;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const hashSecret = process.env.IP_HASH_SECRET;

if (!email || !email.includes("@")) {
  console.error("Usage: npm run create-admin -- owner@example.com");
  process.exit(1);
}
if (!databaseUrl) {
  console.error("MIGRATION_DATABASE_URL is not set.");
  process.exit(1);
}
if (!hashSecret || hashSecret.length < 32) {
  console.error("IP_HASH_SECRET is missing or too short.");
  process.exit(1);
}

const ownerEmail = email;
const migrationUrl = databaseUrl;
const tokenHashSecret = hashSecret;
const pool = new Pool({ connectionString: migrationUrl, max: 1 });

function tokenHash(token: string): string {
  return createHmac("sha256", tokenHashSecret).update(`token:${token}`).digest("hex");
}

async function main() {
  const existing = await pool.query("SELECT id FROM admin_users WHERE lower(email) = $1", [
    ownerEmail,
  ]);
  if (existing.rowCount) {
    throw new Error("An admin with that email already exists.");
  }

  const discardedPassword = randomBytes(32).toString("base64url");
  const passwordHash = await hash(discardedPassword, {
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
    outputLen: 32,
    algorithm: 2 as Algorithm,
  });

  const inviteToken = randomBytes(32).toString("base64url");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO admin_users (email, password_hash, role, is_active, password_changed_at)
       VALUES ($1, $2, 'owner', true, now())
       RETURNING id`,
      [ownerEmail, passwordHash],
    );
    const admin = inserted.rows[0];
    if (!admin) throw new Error("Failed to create admin user.");

    await client.query(
      `INSERT INTO admin_password_tokens (admin_user_id, token_hash, purpose, expires_at)
       VALUES ($1, $2, 'invite', now() + interval '24 hours')`,
      [admin.id, tokenHash(inviteToken)],
    );
    await client.query("COMMIT");

    console.log("Owner account created.");
    console.log(`Invite link (expires in 24 hours): ${siteUrl}/admin/setup?token=${inviteToken}`);
    console.log("Complete password setup and MFA enrolment before using the admin panel.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Admin creation failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
