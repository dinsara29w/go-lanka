import { expect, test } from "@playwright/test";

test("public shell loads with security headers", async ({ page, request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);

  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["set-cookie"]).toBeUndefined();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sri Lanka Journeys");
});

test("mobile shell has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("Menu")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("home exposes canonical metadata and TravelAgency JSON-LD", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "http://localhost:3000",
  );
  const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(jsonLd).toContain('"@type":"TravelAgency"');
});

test("packages page renders with a usable catalogue state", async ({ page }) => {
  await page.goto("/packages");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tour packages");

  const emptyState = page.getByText("Itineraries are being prepared");
  if ((await emptyState.count()) > 0) {
    await expect(emptyState).toBeVisible();
  } else {
    await expect(page.getByRole("article").first()).toBeVisible();
  }
});

test("sitemap is available", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("/packages");
  expect(body).toContain("/contact");
});

test("llms.txt and security.txt are available", async ({ request }) => {
  const llms = await request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  expect(await llms.text()).toContain("# Sri Lanka Tours");

  const security = await request.get("/.well-known/security.txt");
  expect(security.status()).toBe(200);
  expect(await security.text()).toContain("Contact: mailto:");
});

test("robots.txt is available", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("User-Agent");
});

test("admin area and uploads reject anonymous access", async ({ page, request, baseURL }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
    "base64",
  );
  const response = await request.post("/api/admin/uploads", {
    headers: { Origin: baseURL! },
    multipart: {
      file: { name: "anonymous.png", mimeType: "image/png", buffer: png },
      alt: "Anonymous upload",
      category: "packages",
    },
  });
  expect(response.status()).toBe(401);
});

test("unknown package returns a real 404 with the not-found UI", async ({ page }) => {
  const response = await page.goto("/packages/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/i);
});

test("unknown page returns a useful 404 page", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
});

test("public pages have one h1, a main landmark, and no skipped heading levels", async ({
  page,
}) => {
  const paths = [
    "/",
    "/packages",
    "/map",
    "/reviews",
    "/photos",
    "/travel-info",
    "/tour-builder",
    "/contact",
    "/about",
    "/privacy",
    "/terms",
  ];

  for (const path of paths) {
    await page.goto(path);
    await expect(page.locator("main, [role=main]")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const levels = await page
      .locator("h1, h2, h3, h4, h5, h6")
      .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))));

    let previous = 0;
    for (const level of levels) {
      expect(level, `${path}: heading level ${level} follows ${previous}`).toBeLessThanOrEqual(
        previous + 1,
      );
      previous = level;
    }
  }
});

test("skip link is the first focus target and moves focus to main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
});

test("package filters and contact form fields have accessible names", async ({ page }) => {
  await page.goto("/packages");
  await expect(page.getByLabel("Destination")).toBeVisible();
  await expect(page.getByLabel("Activity")).toBeVisible();
  await expect(page.getByLabel("Duration")).toBeVisible();

  await page.goto("/contact");
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Phone or WhatsApp (optional)")).toBeVisible();
  await expect(page.getByLabel("How can we help?")).toBeVisible();
});
