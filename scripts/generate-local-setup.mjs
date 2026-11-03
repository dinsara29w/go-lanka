import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const envPath = join(root, ".env.local");
const bootstrapPath = join(root, "db", "bootstrap.local.sql");

if (existsSync(envPath) || existsSync(bootstrapPath)) {
  console.error("Refusing to overwrite existing .env.local or db/bootstrap.local.sql.");
  console.error("Remove or rename them first if you intentionally want to regenerate credentials.");
  process.exit(1);
}

function secret(bytes, urlSafe = true) {
  const value = randomBytes(bytes).toString("base64");
  return urlSafe ? value.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "") : value;
}

const publicPassword = secret(32);
const authPassword = secret(32);
const adminPassword = secret(32);
const migrationPassword = secret(32);
const ipHashSecret = secret(32, false);
const mfaKey = secret(32, false);
const cronSecret = secret(32);

const env = `NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

PUBLIC_DATABASE_URL=postgresql://golanka_public:${publicPassword}@localhost:5432/go_lanka_dev
AUTH_DATABASE_URL=postgresql://golanka_auth:${authPassword}@localhost:5432/go_lanka_dev
ADMIN_DATABASE_URL=postgresql://golanka_admin:${adminPassword}@localhost:5432/go_lanka_dev
MIGRATION_DATABASE_URL=postgresql://golanka_migrator:${migrationPassword}@localhost:5432/go_lanka_dev

IP_HASH_SECRET=${ipHashSecret}
MFA_ENCRYPTION_KEY=${mfaKey}

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5-5
RESEND_API_KEY=
EMAIL_FROM=
ADMIN_NOTIFICATION_EMAIL=
EXCHANGE_RATE_API_KEY=
EXCHANGE_RATE_API_URL=
CRON_SECRET=${cronSecret}

TRUST_PROXY=none
STORAGE_ROOT=./.data/media
LOG_LEVEL=info
`;

const bootstrap = `-- Local-only bootstrap. Run as the PostgreSQL superuser.
-- It creates the development database and least-privilege roles.
-- Never commit this file.

CREATE ROLE golanka_migrator LOGIN PASSWORD '${migrationPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE golanka_public LOGIN PASSWORD '${publicPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE golanka_auth LOGIN PASSWORD '${authPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE golanka_admin LOGIN PASSWORD '${adminPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

CREATE DATABASE go_lanka_dev OWNER golanka_migrator ENCODING 'UTF8' TEMPLATE template0;
ALTER DATABASE go_lanka_dev SET timezone TO 'UTC';
REVOKE ALL ON DATABASE go_lanka_dev FROM PUBLIC;
GRANT CONNECT ON DATABASE go_lanka_dev TO golanka_migrator, golanka_public, golanka_auth, golanka_admin;

\\connect go_lanka_dev

ALTER SCHEMA public OWNER TO golanka_migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO golanka_migrator, golanka_public, golanka_auth, golanka_admin;
GRANT CREATE ON SCHEMA public TO golanka_migrator;

ALTER ROLE golanka_public SET statement_timeout = '5s';
ALTER ROLE golanka_public SET lock_timeout = '3s';
ALTER ROLE golanka_public SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE golanka_auth SET statement_timeout = '5s';
ALTER ROLE golanka_auth SET lock_timeout = '3s';
ALTER ROLE golanka_auth SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE golanka_admin SET statement_timeout = '10s';
ALTER ROLE golanka_admin SET lock_timeout = '5s';
ALTER ROLE golanka_admin SET idle_in_transaction_session_timeout = '10s';
`;

mkdirSync(dirname(bootstrapPath), { recursive: true });
writeFileSync(envPath, env, { encoding: "utf8", mode: 0o600 });
writeFileSync(bootstrapPath, bootstrap, { encoding: "utf8", mode: 0o600 });
console.log("Created .env.local and db/bootstrap.local.sql.");
console.log("Next: run the bootstrap SQL as PostgreSQL superuser, then npm run db:migrate.");
