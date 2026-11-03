import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";

import { Pool } from "pg";

try {
  loadEnvFile(".env.local");
} catch {
  // Allow CI to inject variables directly.
}

const testPort = process.env.TEST_DB_PORT;
const urls = {
  public: process.env.PUBLIC_DATABASE_URL,
  auth: process.env.AUTH_DATABASE_URL,
  admin: process.env.ADMIN_DATABASE_URL,
  migration: process.env.MIGRATION_DATABASE_URL,
};

for (const [name, url] of Object.entries(urls)) {
  if (!url) {
    console.error(`${name.toUpperCase()}_DATABASE_URL is not set.`);
    process.exit(1);
  }
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    console.error("Refusing to run destructive database smoke tests against a non-local host.");
    process.exit(1);
  }
}

function withPort(url) {
  if (!testPort) return url;
  const parsed = new URL(url);
  parsed.port = testPort;
  return parsed.toString();
}

const pools = {
  public: new Pool({ connectionString: withPort(urls.public), max: 1 }),
  auth: new Pool({ connectionString: withPort(urls.auth), max: 1 }),
  admin: new Pool({ connectionString: withPort(urls.admin), max: 1 }),
  migration: new Pool({ connectionString: withPort(urls.migration), max: 1 }),
};

const fixture = {
  destinationId: randomUUID(),
  packageId: randomUUID(),
  adminId: randomUUID(),
  photoId: null,
  bookingId: null,
  reference: `GL-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
  idempotencyKey: `smoke-${randomUUID()}`,
  travelDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
};

async function expectPermissionDenied(pool, sql, params = []) {
  await assert.rejects(() => pool.query(sql, params), /permission denied/);
}

async function main() {
  const migration = pools.migration;

  await migration.query(
    `INSERT INTO destinations (id, name, slug, region, description, map_region_id)
     VALUES ($1, 'Smoke destination', $2, 'Test', 'Test description', 'test-region')`,
    [fixture.destinationId, `smoke-destination-${fixture.destinationId.slice(0, 8)}`],
  );
  await migration.query(
    `INSERT INTO packages (id, title, slug, summary, duration_days, base_price_lkr,
                           daily_rate_lkr, tier, is_published)
     VALUES ($1, 'Smoke package', $2, 'Smoke summary', 7, 100000, 15000, 'star', true)`,
    [fixture.packageId, `smoke-package-${fixture.packageId.slice(0, 8)}`],
  );
  await migration.query(
    `INSERT INTO availability (package_id, date, capacity, status)
     VALUES ($1, $2::date, 2, 'open')`,
    [fixture.packageId, fixture.travelDate],
  );
  await migration.query(
    `INSERT INTO admin_users (id, email, password_hash, role, is_active)
     VALUES ($1, $2, 'smoke-test-not-a-real-hash', 'owner', true)`,
    [fixture.adminId, `smoke-${fixture.adminId.slice(0, 8)}@example.com`],
  );

  const publicPackages = await pools.public.query(
    "SELECT count(*)::int AS count FROM packages WHERE id = $1",
    [fixture.packageId],
  );
  assert.equal(publicPackages.rows[0].count, 1);

  const settings = await pools.public.query("SELECT count(*)::int AS count FROM site_settings");
  assert.equal(settings.rows[0].count, 1);

  await expectPermissionDenied(pools.public, "SELECT count(*) FROM bookings");
  await expectPermissionDenied(pools.public, "SELECT count(*) FROM admin_users");
  await expectPermissionDenied(pools.public, "SELECT count(*) FROM photo_submissions");
  await expectPermissionDenied(
    pools.public,
    `INSERT INTO bookings (reference, type, name, email, phone, country, travel_date, adults, currency_shown)
     VALUES ('GL-DENY01', 'custom', 'x', 'x@example.com', 'x', 'LK', current_date + 1, 1, 'LKR')`,
  );

  const booking = await pools.public.query(
    `SELECT * FROM create_booking(
       $1::text, $2::uuid, 'package', 'Smoke Traveler', 'smoke-traveler@example.com',
       '+94770000000', 'LK', $3::date, 2, 0, 'Smoke booking', NULL,
       'LKR', $4::text
     )`,
    [fixture.reference, fixture.packageId, fixture.travelDate, fixture.idempotencyKey],
  );
  fixture.bookingId = booking.rows[0].booking_id;
  assert.equal(booking.rows[0].booking_status, "new");

  const duplicate = await pools.public.query(
    `SELECT * FROM create_booking(
       $1::text, $2::uuid, 'package', 'Smoke Traveler', 'smoke-traveler@example.com',
       '+94770000000', 'LK', $3::date, 2, 0, 'Smoke booking', NULL,
       'LKR', $4::text
     )`,
    [
      `GL-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      fixture.packageId,
      fixture.travelDate,
      fixture.idempotencyKey,
    ],
  );
  assert.equal(duplicate.rows[0].booking_id, fixture.bookingId);

  await assert.rejects(
    () =>
      pools.public.query(
        `SELECT * FROM create_booking(
           $1::text, $2::uuid, 'package', 'Oversell Traveler', 'oversell@example.com',
           '+94770000000', 'LK', $3::date, 1, 0, 'This should not fit', NULL,
           'LKR', $4::text
         )`,
        [
          `GL-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
          fixture.packageId,
          fixture.travelDate,
          `oversell-${randomUUID()}`,
        ],
      ),
    /date_unavailable/,
  );

  await pools.admin.query("SELECT confirm_booking($1::uuid, $2::uuid, 'ip-hash', 'ua-hash')", [
    fixture.bookingId,
    fixture.adminId,
  ]);

  const afterConfirm = await pools.public.query(
    "SELECT booked, pending FROM get_public_availability($1::uuid)",
    [fixture.packageId],
  );
  assert.equal(afterConfirm.rows[0].booked, 2);
  assert.equal(afterConfirm.rows[0].pending, 0);

  await pools.admin.query("SELECT cancel_booking($1::uuid, $2::uuid, 'ip-hash', 'ua-hash')", [
    fixture.bookingId,
    fixture.adminId,
  ]);

  const afterCancel = await pools.public.query(
    "SELECT booked, pending FROM get_public_availability($1::uuid)",
    [fixture.packageId],
  );
  assert.equal(afterCancel.rows[0].booked, 0);
  assert.equal(afterCancel.rows[0].pending, 0);

  const photo = await pools.public.query(
    `SELECT submit_photo('submissions/smoke.webp', 'Smoke caption', 'Smoke alt', 'Smoke Tester', true, $1::uuid) AS id`,
    [fixture.packageId],
  );
  fixture.photoId = photo.rows[0].id;

  const beforeApproval = await pools.public.query(
    "SELECT count(*)::int AS count FROM get_approved_photo($1::uuid)",
    [fixture.photoId],
  );
  assert.equal(beforeApproval.rows[0].count, 0);

  await pools.admin.query(
    "UPDATE photo_submissions SET status = 'approved', alt_text = 'Smoke approved alt' WHERE id = $1::uuid",
    [fixture.photoId],
  );

  const afterApproval = await pools.public.query(
    "SELECT count(*)::int AS count FROM get_approved_photo($1::uuid)",
    [fixture.photoId],
  );
  assert.equal(afterApproval.rows[0].count, 1);

  const authAdmins = await pools.auth.query("SELECT count(*)::int AS count FROM admin_users");
  assert.ok(authAdmins.rows[0].count >= 1);
  await expectPermissionDenied(pools.auth, "SELECT count(*) FROM bookings");

  const adminBookings = await pools.admin.query("SELECT id FROM bookings WHERE id = $1::uuid", [
    fixture.bookingId,
  ]);
  assert.equal(adminBookings.rowCount, 1);

  console.log("Database security smoke tests passed.");
}

try {
  await main();
} finally {
  try {
    if (fixture.bookingId) {
      await pools.migration.query("DELETE FROM bookings WHERE id = $1::uuid", [fixture.bookingId]);
    }
    if (fixture.photoId) {
      await pools.migration.query("DELETE FROM photo_submissions WHERE id = $1::uuid", [
        fixture.photoId,
      ]);
    }
    await pools.migration.query("DELETE FROM admin_audit_log WHERE actor_id = $1::uuid", [
      fixture.adminId,
    ]);
    await pools.migration.query("DELETE FROM availability WHERE package_id = $1::uuid", [
      fixture.packageId,
    ]);
    await pools.migration.query("DELETE FROM packages WHERE id = $1::uuid", [fixture.packageId]);
    await pools.migration.query("DELETE FROM destinations WHERE id = $1::uuid", [
      fixture.destinationId,
    ]);
    await pools.migration.query("DELETE FROM admin_users WHERE id = $1::uuid", [fixture.adminId]);
  } catch (error) {
    console.error("Smoke test cleanup failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }

  await Promise.all(Object.values(pools).map((pool) => pool.end()));
}
