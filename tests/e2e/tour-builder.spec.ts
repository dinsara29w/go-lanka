import { createHmac, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";

import { expect, test } from "@playwright/test";
import { Pool } from "pg";

try {
  loadEnvFile(".env.local");
} catch {
  // CI can provide environment variables directly.
}

const sessionId = randomUUID();
const fixtureDestinationId = randomUUID();
const fixturePackageId = randomUUID();
let pool: Pool | null = null;
let documentId: string | null = null;
let documentPath: string | null = null;

const itinerary = {
  title: "Test custom itinerary",
  summary: "A two-day test itinerary.",
  selected_package_slug: "builder-package",
  days: [
    {
      day: 1,
      title: "Arrival",
      destination_slug: "colombo",
      activities: ["Culture"],
      overnight: "Test hotel",
      notes: "Arrive and settle in.",
      travel_km: 0,
    },
    {
      day: 2,
      title: "Explore",
      destination_slug: "galle",
      activities: ["Culture"],
      overnight: "To be confirmed by the team",
      notes: "Continue exploring.",
      travel_km: 120,
    },
  ],
};

const breakdown = {
  package: {
    id: "00000000-0000-4000-8000-000000000000",
    title: "Builder Test Package",
    slug: "builder-package",
    tier: "star",
    dailyRateLkr: 25000,
    days: 2,
    travellerUnits: 2,
    board: "half_board",
    boardPercent: 5,
    adjustedDailyRateLkr: 26250,
    subtotalLkr: 105000,
  },
  ride: {
    vehicleId: null,
    vehicleName: null,
    perKmRateLkr: 0,
    distanceKm: 120,
    distanceLkr: 0,
    selfDrive: false,
    driverDays: 2,
    driverDailyRateLkr: 0,
    driverLkr: 0,
    subtotalLkr: 0,
  },
  totalLkr: 105000,
  notes: [],
};

test.beforeAll(async () => {
  const databaseUrl = process.env.MIGRATION_DATABASE_URL;
  if (!databaseUrl) throw new Error("MIGRATION_DATABASE_URL is required");
  pool = new Pool({ connectionString: databaseUrl, max: 2 });
  await pool.query(
    `INSERT INTO ai_sessions (id, quiz_answers, itinerary, ip_hash)
     VALUES ($1, '{}'::jsonb, $2::jsonb, $3)`,
    [sessionId, JSON.stringify(itinerary), "a".repeat(64)],
  );
  await pool.query(
    `INSERT INTO destinations (id, name, slug, region, description, map_region_id)
     VALUES ($1, 'Builder Test Destination', $2, 'Western', 'A test destination.', 'colombo')`,
    [fixtureDestinationId, `builder-destination-${sessionId.slice(0, 8)}`],
  );
  await pool.query(
    `INSERT INTO packages (id, title, slug, summary, duration_days, base_price_lkr,
                           daily_rate_lkr, tier, activities, is_published)
     VALUES ($1, 'Builder Test Package', $2, 'A test package.', 3, 100000,
             25000, 'star', ARRAY['Culture'], true)`,
    [fixturePackageId, `builder-package-${sessionId.slice(0, 8)}`],
  );
  await pool.query(
    "INSERT INTO package_destinations (package_id, destination_id) VALUES ($1, $2)",
    [fixturePackageId, fixtureDestinationId],
  );
});

test.afterAll(async () => {
  if (!pool) return;
  try {
    if (documentId) await pool.query("DELETE FROM tour_documents WHERE id = $1", [documentId]);
    await pool.query("DELETE FROM tour_quotes WHERE ai_session_id = $1", [sessionId]);
    await pool.query("DELETE FROM ai_sessions WHERE id = $1", [sessionId]);
    await pool.query("DELETE FROM packages WHERE id = $1", [fixturePackageId]);
    await pool.query("DELETE FROM destinations WHERE id = $1", [fixtureDestinationId]);
    if (documentPath) {
      const storageRoot = process.env.STORAGE_ROOT ?? "./.data/media";
      await unlink(path.join(process.cwd(), storageRoot, "private", documentPath)).catch(
        () => undefined,
      );
    }
  } finally {
    await pool.end();
  }
});

test("tour builder degrades safely when the model is unavailable", async ({ request, baseURL }) => {
  const response = await request.post("/api/tour-builder", {
    headers: {
      Origin: baseURL!,
      "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 200) + 20}`,
    },
    data: {
      locations: ["colombo"],
      budget: "star",
      board: "half_board",
      selfDrive: false,
      days: 2,
      nights: 1,
      travelMonth: 11,
      adults: 2,
      children: 0,
      notes: "",
      turnstileToken: "test-token",
    },
  });

  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain('"type":"progress"');
  expect(body).toContain('"type":"fallback"');
});

test("itinerary PDF capability expires", async ({ request }) => {
  if (!pool) throw new Error("Test database unavailable");
  const hashSecret = process.env.IP_HASH_SECRET;
  if (!hashSecret) throw new Error("IP_HASH_SECRET is required");

  const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const tokenHash = createHmac("sha256", hashSecret).update(`token:${token}`).digest("hex");
  const storageRoot = process.env.STORAGE_ROOT ?? "./.data/media";
  documentPath = `documents/${randomUUID()}.pdf`;
  const absolutePath = path.join(process.cwd(), storageRoot, "private", documentPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from("%PDF-1.4\nTest itinerary\n%%EOF"));

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO tour_documents (ai_session_id, token_hash, file_path, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 hour')
     RETURNING id`,
    [sessionId, tokenHash, documentPath],
  );
  documentId = inserted.rows[0]?.id ?? null;
  if (!documentId) throw new Error("Document id missing");

  const download = await request.get(`/tour-builder/pdf/${token}`);
  expect(download.status()).toBe(200);
  expect(await download.text()).toContain("%PDF");

  await pool.query(
    "UPDATE tour_documents SET expires_at = now() - interval '1 minute' WHERE id = $1",
    [documentId],
  );
  const expired = await request.get(`/tour-builder/pdf/${token}`);
  expect(expired.status()).toBe(404);
});

test("custom AI itinerary quote moves to admin review", async ({ request, baseURL }) => {
  if (!pool) throw new Error("Test database unavailable");
  const reference = `GL-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const quote = await pool.query<{ id: string }>(
    `SELECT create_tour_quote(
       $1::text, $2::uuid, $3::jsonb, $4::jsonb, $5::jsonb, $6::numeric,
       $7::uuid, $8::text, $9::text, $10::numeric, NULL::uuid, NULL::text, $11::numeric
     ) AS id`,
    [
      reference,
      sessionId,
      JSON.stringify({ budget: "star", board: "half_board", days: 2, nights: 1, adults: 2 }),
      JSON.stringify(itinerary),
      JSON.stringify(breakdown),
      breakdown.totalLkr,
      fixturePackageId,
      "Builder Test Package",
      "builder-package",
      25000,
      120,
    ],
  );
  const quoteId = quote.rows[0]?.id;
  if (!quoteId) throw new Error("Quote id missing");

  const travelDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const response = await request.post("/api/tour-builder/quote", {
    headers: {
      Origin: baseURL!,
      "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 200) + 20}`,
    },
    data: {
      sessionId,
      reference,
      travelDate,
      name: "AI Quote Tester",
      email: `ai-quote-${sessionId.slice(0, 8)}@example.com`,
      phone: "+94770000000",
      country: "LK",
      message: "Please confirm this custom itinerary.",
      turnstileToken: "test-token",
      idempotencyKey: `ai-quote-${sessionId}`,
    },
  });

  expect(response.status()).toBe(200);
  const body = (await response.json()) as { ok?: boolean; reference?: string };
  expect(body.ok).toBe(true);
  expect(body.reference).toBe(reference);

  const result = await pool.query<{ status: string; phone: string }>(
    "SELECT status, phone FROM tour_quotes WHERE id = $1",
    [quoteId],
  );
  expect(result.rows[0]?.status).toBe("pending_review");
  expect(result.rows[0]?.phone).toBe("+94770000000");
});
