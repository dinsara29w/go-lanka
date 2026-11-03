import "server-only";

import { Pool, type PoolClient } from "pg";

import { getServerEnv } from "@/server/env";

type PoolName = "public" | "auth" | "admin";

const globalForPools = globalThis as unknown as {
  __goLankaPools?: Partial<Record<PoolName, Pool>>;
};

function createPool(name: PoolName, connectionString: string, max: number): Pool {
  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: `go-lanka-${name}`,
    allowExitOnIdle: false,
  });
}

function getPool(name: PoolName): Pool {
  const existing = globalForPools.__goLankaPools?.[name];
  if (existing) return existing;

  const env = getServerEnv();
  const config = {
    public: { url: env.PUBLIC_DATABASE_URL, max: 10 },
    auth: { url: env.AUTH_DATABASE_URL, max: 5 },
    admin: { url: env.ADMIN_DATABASE_URL, max: 5 },
  }[name];

  const pool = createPool(name, config.url, config.max);
  globalForPools.__goLankaPools ??= {};
  globalForPools.__goLankaPools[name] = pool;
  return pool;
}

export function getPublicPool(): Pool {
  return getPool("public");
}

export function getAuthPool(): Pool {
  return getPool("auth");
}

export function getAdminPool(): Pool {
  return getPool("admin");
}

export async function withTransaction<T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function closePools(): Promise<void> {
  const pools = globalForPools.__goLankaPools;
  if (!pools) return;
  await Promise.all(Object.values(pools).map((pool) => pool?.end()));
  globalForPools.__goLankaPools = undefined;
}
