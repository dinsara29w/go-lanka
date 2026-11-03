import { createDecipheriv, createHmac, randomBytes, randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";

import { expect, test } from "@playwright/test";
import { generate } from "otplib";
import { Pool } from "pg";
import sharp from "sharp";

try {
  loadEnvFile(".env.local");
} catch {
  // CI can provide environment variables directly.
}

const suffix = randomUUID().slice(0, 8);
const adminId = randomUUID();
const email = `e2e-admin-${suffix}@golanka.com`;
const inviteToken = randomBytes(32).toString("base64url");
const password = "E2e-strong-password-123";
const destinationSlug = `e2e-destination-${suffix}`;
const packageSlug = `e2e-package-${suffix}`;
const packageTitle = `E2E Journey ${suffix}`;
const reviewTitle = `E2E review ${suffix}`;
const travelSlug = `e2e-travel-${suffix}`;
const testIp = `203.0.113.${Math.floor(Math.random() * 200) + 20}`;

let pool: Pool | null = null;
let uploadedImageUrl: string | null = null;
let bookingId: string | null = null;
let photoId: string | null = null;
let photoImagePath: string | null = null;

function tokenHash(token: string): string {
  return createHmac("sha256", process.env.IP_HASH_SECRET ?? "")
    .update(`token:${token}`)
    .digest("hex");
}

function decryptMfaSecret(payload: string): string {
  const [version, ivPart, tagPart, ciphertextPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error("Invalid MFA payload");
  }
  const key = Buffer.from(process.env.MFA_ENCRYPTION_KEY ?? "", "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
  decipher.setAAD(Buffer.from("go-lanka:mfa:v1", "utf8"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const databaseUrl = process.env.MIGRATION_DATABASE_URL;
  if (!databaseUrl) throw new Error("MIGRATION_DATABASE_URL is required for admin tests");
  if (!process.env.IP_HASH_SECRET || !process.env.MFA_ENCRYPTION_KEY) {
    throw new Error("Admin test secrets are missing");
  }

  pool = new Pool({ connectionString: databaseUrl, max: 2 });
  await pool.query(
    `INSERT INTO admin_users (id, email, password_hash, role, is_active)
     VALUES ($1, $2, 'temporary-not-a-real-hash', 'admin', true)`,
    [adminId, email],
  );
  await pool.query(
    `INSERT INTO admin_password_tokens (admin_user_id, token_hash, purpose, expires_at)
     VALUES ($1, $2, 'invite', now() + interval '1 hour')`,
    [adminId, tokenHash(inviteToken)],
  );
});

test.afterAll(async () => {
  if (!pool) return;
  try {
    if (bookingId) {
      await pool.query("DELETE FROM bookings WHERE id = $1", [bookingId]);
    }
    await pool.query("DELETE FROM reviews WHERE title = $1", [reviewTitle]);
    await pool.query("DELETE FROM travel_info_sections WHERE slug = $1", [travelSlug]);
    if (photoId) {
      const photo = await pool.query<{ image_path: string }>(
        "SELECT image_path FROM photo_submissions WHERE id = $1",
        [photoId],
      );
      photoImagePath = photo.rows[0]?.image_path ?? photoImagePath;
      await pool.query("DELETE FROM photo_submissions WHERE id = $1", [photoId]);
    }
    await pool.query("DELETE FROM packages WHERE slug = $1", [packageSlug]);
    await pool.query("DELETE FROM destinations WHERE slug = $1", [destinationSlug]);
    await pool.query("DELETE FROM admin_audit_log WHERE actor_id = $1", [adminId]);
    await pool.query("DELETE FROM admin_users WHERE id = $1", [adminId]);

    if (uploadedImageUrl?.startsWith("/media/")) {
      const storageRoot = process.env.STORAGE_ROOT ?? "./.data/media";
      const filePath = path.join(
        process.cwd(),
        storageRoot,
        "public",
        uploadedImageUrl.replace(/^\/media\//, ""),
      );
      await unlink(filePath).catch(() => undefined);
    }
    if (photoImagePath) {
      const storageRoot = process.env.STORAGE_ROOT ?? "./.data/media";
      const filePath = path.join(process.cwd(), storageRoot, "private", photoImagePath);
      await unlink(filePath).catch(() => undefined);
    }
  } catch {
    // Cleanup must not hide the test result.
  } finally {
    await pool.end();
  }
});

test("admin setup, MFA login and logout work", async ({ page }) => {
  test.setTimeout(120_000);
  if (!pool) throw new Error("Test database is not available");

  const db = pool;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": testIp });
  await page.goto(`/admin/setup?token=${encodeURIComponent(inviteToken)}`);
  await expect(page.getByRole("heading", { name: "Set up your admin account" })).toBeVisible();

  const secretResult = await pool.query<{ mfa_secret_encrypted: string }>(
    "SELECT mfa_secret_encrypted FROM admin_users WHERE id = $1",
    [adminId],
  );
  const encrypted = secretResult.rows[0]?.mfa_secret_encrypted;
  if (!encrypted) throw new Error("MFA secret was not prepared");
  const secret = decryptMfaSecret(encrypted);
  const setupCode = await generate({ secret });

  await page.getByLabel("New password").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByLabel("Authenticator code").fill(setupCode);
  await page.getByRole("button", { name: "Complete setup" }).click();

  await expect(page.getByRole("heading", { name: "Save your recovery codes" })).toBeVisible();
  await page.getByRole("button", { name: "Continue to admin" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

  await page.goto("/admin/destinations/new");
  await page.getByLabel("Name").fill(`E2E Destination ${suffix}`);
  await page.getByLabel("Slug").fill(destinationSlug);
  await page.getByLabel("Region", { exact: true }).fill("Test Region");
  await page.getByLabel("Map region ID").selectOption("colombo");
  await page.getByLabel("Description").fill("A destination created by the end-to-end test.");
  await page.getByLabel("Best season").fill("Year round");
  await page.getByLabel("Highlights").fill("Testing\nBeautiful scenery");
  await page.getByRole("button", { name: "Save destination" }).click();
  await expect(page).toHaveURL(/\/admin\/destinations\/[0-9a-f-]+$/);

  const destinationId = new URL(page.url()).pathname.split("/").at(-1);
  if (!destinationId) throw new Error("Destination id missing");

  await page.goto("/admin/packages/new");
  await page.getByLabel("Title", { exact: true }).fill(packageTitle);
  await page.getByLabel("Slug", { exact: true }).fill(packageSlug);
  await page.getByLabel("Duration (days)").fill("5");
  await page.getByLabel("Summary").fill("A five-day end-to-end test journey.");
  await page.getByLabel("Base price (LKR)").fill("125000");
  await page.getByLabel("Activities").fill("Culture\nWildlife");
  await page.getByLabel("Inclusions").fill("Accommodation\nBreakfast");
  await page.getByLabel("Exclusions").fill("Flights");

  const imageBuffer = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 210, g: 225, b: 210 },
    },
  })
    .png()
    .toBuffer();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "e2e-hero.png",
    mimeType: "image/png",
    buffer: imageBuffer,
  });
  await page
    .getByPlaceholder("Describe the image for screen readers.")
    .first()
    .fill("E2E hero image");
  await page.getByRole("button", { name: "Upload image" }).first().click();
  await expect(page.locator('input[name="heroImage"]')).not.toHaveValue("");
  uploadedImageUrl = await page.locator('input[name="heroImage"]').inputValue();

  await page.getByLabel("Destinations").selectOption([destinationId]);
  await page.getByLabel("Published").check();
  await page.getByLabel("Day title", { exact: true }).fill("Arrival and exploration");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Arrive, settle in and explore the local area.");
  await page.getByLabel("Accommodation", { exact: true }).fill("Test hotel");
  await page.getByLabel("Meals", { exact: true }).fill("Breakfast, Dinner");
  await page.getByRole("button", { name: "Save package" }).click();
  await expect(page).toHaveURL(/\/admin\/packages\/[0-9a-f-]+$/);

  const noCsrfUpload = await page.request.post("/api/admin/uploads", {
    headers: { Origin: "http://localhost:3000" },
    multipart: {
      file: {
        name: "no-csrf.png",
        mimeType: "image/png",
        buffer: imageBuffer,
      },
      alt: "No CSRF image",
      category: "packages",
    },
  });
  expect(noCsrfUpload.status()).toBe(403);

  const csrfToken = await page.locator('input[name="_csrf"]').first().inputValue();
  const invalidUpload = await page.request.post("/api/admin/uploads", {
    headers: { Origin: "http://localhost:3000", "X-CSRF-Token": csrfToken },
    multipart: {
      file: {
        name: "fake.png",
        mimeType: "image/png",
        buffer: Buffer.from("this is not an image"),
      },
      alt: "Invalid image",
      category: "packages",
    },
  });
  expect(invalidUpload.status()).toBe(400);

  const ownerPage = await page.goto("/admin/team");
  expect(ownerPage?.status()).toBe(404);

  await page.goto(`/packages/${packageSlug}`);
  await expect(page.getByRole("heading", { level: 1, name: packageTitle })).toBeVisible();
  await expect(page.getByText("Arrival and exploration")).toBeVisible();
  await expect(page.getByAltText("E2E hero image").first()).toBeVisible();

  await page.getByLabel("Currency").first().selectOption("GBP");
  await expect(page.getByText(/£/).first()).toBeVisible();

  await page.goto(`/packages?destination=${destinationSlug}&activity=Culture&duration=4-7`);
  await expect(page.getByRole("heading", { name: packageTitle })).toBeVisible();

  const packageRow = await pool.query<{ id: string }>("SELECT id FROM packages WHERE slug = $1", [
    packageSlug,
  ]);
  const packageUuid = packageRow.rows[0]?.id;
  if (!packageUuid) throw new Error("Package id missing");

  await page.goto("/map");
  await page.getByRole("button", { name: /Colombo district/i }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(`E2E Destination ${suffix}`)).toBeVisible();

  await page.goto("/admin/reviews/new");
  await page.getByLabel("Packages").selectOption(packageUuid);
  await page.getByLabel("Author name").fill("E2E Reviewer");
  await page.getByLabel("Author country").fill("Australia");
  await page.getByLabel("Rating").selectOption("5");
  await page.getByLabel("Review title").fill(reviewTitle);
  await page.getByLabel("Review body").fill("A verified end-to-end review of the test journey.");
  await page.getByLabel("Verified").check();
  await page.getByLabel("Published").check();
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page).toHaveURL(/\/admin\/reviews$/);
  await page.goto("/reviews");
  await expect(page.getByText(reviewTitle)).toBeVisible();

  await page.goto("/admin/travel-info/new");
  await page.getByLabel("Section title").fill(`E2E Travel ${suffix}`);
  await page.getByLabel("Slug").fill(travelSlug);
  await page.getByLabel("Short summary").fill("End-to-end travel information.");
  await page.getByLabel("Body").fill("Practical information created by the end-to-end test.");
  await page
    .getByLabel("Bullet points")
    .fill("Bring a light rain jacket\nCarry cash for small purchases");
  await page.getByRole("button", { name: "Add FAQ" }).click();
  await page.getByPlaceholder("Question").fill(`What should I pack for ${suffix}?`);
  await page.getByPlaceholder("Answer").fill("Pack light layers and a rain jacket.");
  await page.getByLabel("Published").check();
  await page.getByRole("button", { name: "Save section" }).click();
  await expect(page).toHaveURL(/\/admin\/travel-info$/);
  await page.goto("/travel-info");
  await expect(page.getByRole("heading", { name: `E2E Travel ${suffix}` })).toBeVisible();
  await expect(page.getByText(`What should I pack for ${suffix}?`)).toBeVisible();

  const travelDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  await page.goto(`/admin/availability?packageId=${packageUuid}`);
  await page.getByLabel("Start date").fill(travelDate);
  await page.getByLabel("End date").fill(travelDate);
  await page.getByLabel("Capacity").fill("10");
  await page.getByRole("button", { name: "Apply availability" }).click();
  await expect(page.getByText("Availability updated.")).toBeVisible();

  const bookingBody = {
    name: "API Tester",
    email: `api-${suffix}@example.com`,
    phone: "+94770000000",
    country: "LK",
    travelDate,
    adults: 2,
    children: 0,
    message: "Booking API abuse test.",
    website: "",
    packageId: packageUuid,
    turnstileToken: "test-token",
    idempotencyKey: `api-key-${suffix}-1234`,
  };

  const crossOriginBooking = await page.request.post("/api/bookings", {
    headers: { Origin: "https://evil.example", "x-forwarded-for": "203.0.113.30" },
    data: bookingBody,
  });
  expect(crossOriginBooking.status()).toBe(403);

  const oversizedBooking = await page.request.post("/api/bookings", {
    headers: { Origin: "http://localhost:3000", "x-forwarded-for": "203.0.113.31" },
    data: { ...bookingBody, message: "x".repeat(40_000) },
  });
  expect(oversizedBooking.status()).toBe(413);

  const rateLimitIp = `203.0.113.${Math.floor(Math.random() * 200) + 20}`;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await page.request.post("/api/bookings", {
      headers: { Origin: "http://localhost:3000", "x-forwarded-for": rateLimitIp },
      data: {
        ...bookingBody,
        email: `rate-${suffix}-${attempt}@example.com`,
        website: "filled-by-a-bot",
        idempotencyKey: `rate-key-${suffix}-${attempt}-1234`,
      },
    });
    expect(response.status()).toBe(attempt < 5 ? 200 : 429);
  }

  await page.addInitScript(() => {
    let widget = 0;
    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: {
        render: (_element: HTMLElement, options: { callback?: (token: string) => void }) => {
          widget += 1;
          setTimeout(() => options.callback?.("booking-e2e-token"), 0);
          return `e2e-widget-${widget}`;
        },
        remove: () => undefined,
      },
    });
  });

  await page.goto(`/packages/${packageSlug}`);
  await expect(page.getByRole("heading", { name: "Request this trip" })).toBeVisible();
  const displayDate = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${travelDate}T00:00:00Z`));
  await page.getByRole("button", { name: new RegExp(displayDate) }).click();

  await page.getByLabel("Full name").fill("E2E Booking Traveller");
  await page.getByLabel("Email address").fill(`booking-${suffix}@example.com`);
  await page.getByLabel("Phone or WhatsApp").fill("+94770000000");
  await page.getByLabel("Country").fill("LK");
  const bookButton = page.getByRole("button", { name: "Send booking request" });
  await expect(bookButton).toBeEnabled({ timeout: 20_000 });
  await bookButton.click();

  await expect(page).toHaveURL(/\/booking\/success\?reference=GL-[A-Z0-9]+/, {
    timeout: 30_000,
  });
  const reference = new URL(page.url()).searchParams.get("reference");
  if (!reference) throw new Error("Booking reference missing");

  const bookingRow = await pool.query<{ id: string }>(
    "SELECT id FROM bookings WHERE reference = $1",
    [reference],
  );
  bookingId = bookingRow.rows[0]?.id ?? null;
  if (!bookingId) throw new Error("Booking id missing");

  await page.goto(`/admin/bookings/${bookingId}`);
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("Confirmed").first()).toBeVisible();

  const confirmed = await pool.query<{ status: string }>(
    "SELECT status FROM bookings WHERE id = $1",
    [bookingId],
  );
  expect(confirmed.rows[0]?.status).toBe("confirmed");

  const booked = await pool.query<{ booked: number }>(
    "SELECT booked FROM availability WHERE package_id = $1 AND date = $2",
    [packageUuid, travelDate],
  );
  expect(booked.rows[0]?.booked).toBe(2);

  const csv = await page.request.get(`/admin/bookings/export?q=${encodeURIComponent(reference)}`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain(reference);

  await page.getByRole("button", { name: "Mark completed" }).click();
  await expect(page.getByText("Completed").first()).toBeVisible();

  const photoCaption = `E2E traveller photo ${suffix}`;
  await page.goto("/photos");
  await page.locator("#photo-file").setInputFiles({
    name: "traveller-photo.png",
    mimeType: "image/png",
    buffer: imageBuffer,
  });
  await page.getByLabel("Related journey (optional)").selectOption(packageUuid);
  await page.getByLabel("Caption (optional)").fill(photoCaption);
  await page.getByLabel("Your name (optional)").fill("E2E Photographer");
  await page.getByRole("checkbox").check();
  const photoSubmit = page.getByRole("button", { name: "Submit photo" });
  await expect(photoSubmit).toBeEnabled({ timeout: 20_000 });
  await photoSubmit.click();
  await expect(
    page.getByText("Thank you. Your photo has been submitted for moderation."),
  ).toBeVisible();

  const photoRow = await pool.query<{ id: string; image_path: string }>(
    "SELECT id, image_path FROM photo_submissions WHERE caption = $1",
    [photoCaption],
  );
  photoId = photoRow.rows[0]?.id ?? null;
  photoImagePath = photoRow.rows[0]?.image_path ?? null;
  if (!photoId) throw new Error("Photo id missing");

  expect((await page.request.get(`/photos/${photoId}`)).status()).toBe(404);
  expect((await page.request.get(`/admin/photos/${photoId}/preview`)).status()).toBe(200);

  await page.goto("/admin/photos");
  await page.locator('input[name="altText"]').first().fill("Approved E2E traveller photo");
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect
    .poll(async () => {
      const row = await db.query<{ status: string; image_path: string }>(
        "SELECT status, image_path FROM photo_submissions WHERE id = $1",
        [photoId],
      );
      return row.rows[0]?.status;
    })
    .toBe("approved");

  const approvedRow = await pool.query<{ status: string; image_path: string }>(
    "SELECT status, image_path FROM photo_submissions WHERE id = $1",
    [photoId],
  );
  expect(approvedRow.rows[0]?.image_path).toBe(photoImagePath);
  expect((await page.request.get(`/photos/${photoId}`)).status()).toBe(200);

  await page.goto("/photos");
  await expect(page.getByText(photoCaption)).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/admin/packages");
  await page
    .getByRole("row", { name: new RegExp(packageTitle) })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL(/\/admin\/packages$/);

  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/admin/destinations");
  await page
    .getByRole("row", { name: new RegExp(destinationSlug) })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL(/\/admin\/destinations$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();

  // Allow the current TOTP step to be used for this login test.
  await pool.query("UPDATE admin_users SET mfa_last_used_step = NULL WHERE id = $1", [adminId]);
  const loginCode = await generate({ secret });

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Authenticator code").fill(loginCode);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

  await pool.query(
    "UPDATE admin_sessions SET expires_at = now() - interval '1 minute' WHERE admin_user_id = $1 AND revoked_at IS NULL",
    [adminId],
  );
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});
