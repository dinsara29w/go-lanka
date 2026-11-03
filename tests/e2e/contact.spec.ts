import { expect, test } from "@playwright/test";

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

function uniqueIp() {
  return `203.0.113.${Math.floor(Math.random() * 200) + 20}`;
}

test("contact API accepts a verified request from the same origin", async ({
  request,
  baseURL,
}) => {
  const response = await request.post("/api/contact", {
    headers: {
      Origin: baseURL!,
      "x-forwarded-for": uniqueIp(),
    },
    data: {
      name: "E2E Tester",
      email: uniqueEmail(),
      phone: "+94770000000",
      message: "This is an end-to-end contact form test message.",
      website: "",
      turnstileToken: "test-token",
    },
  });

  expect(response.status()).toBe(200);
  const body = (await response.json()) as { ok?: boolean };
  expect(body.ok).toBe(true);
});

test("contact API rejects cross-origin requests", async ({ request }) => {
  const response = await request.post("/api/contact", {
    headers: {
      Origin: "https://evil.example",
      "x-forwarded-for": uniqueIp(),
    },
    data: {
      name: "E2E Tester",
      email: uniqueEmail(),
      message: "Cross-origin request should be rejected.",
      website: "",
      turnstileToken: "test-token",
    },
  });

  expect(response.status()).toBe(403);
});

test("contact API validates malformed bodies", async ({ request, baseURL }) => {
  const response = await request.post("/api/contact", {
    headers: {
      Origin: baseURL!,
      "x-forwarded-for": uniqueIp(),
    },
    data: { name: "Only a name" },
  });

  expect(response.status()).toBe(400);
});

test("contact API rejects oversized bodies", async ({ request, baseURL }) => {
  const response = await request.post("/api/contact", {
    headers: {
      Origin: baseURL!,
      "x-forwarded-for": uniqueIp(),
    },
    data: {
      name: "Oversized Tester",
      email: uniqueEmail(),
      message: "x".repeat(20_000),
      website: "",
      turnstileToken: "test-token",
    },
  });

  expect(response.status()).toBe(413);
});

test("contact API rate-limits repeated submissions", async ({ request, baseURL }) => {
  const ip = uniqueIp();
  const headers = { Origin: baseURL!, "x-forwarded-for": ip };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request.post("/api/contact", {
      headers,
      data: {
        name: "Rate Limit Tester",
        email: uniqueEmail(),
        message: "This request should be stopped by the honeypot before email delivery.",
        website: "filled-by-a-bot",
        turnstileToken: "test-token",
      },
    });
    expect(response.status()).toBe(200);
  }

  const blocked = await request.post("/api/contact", {
    headers,
    data: {
      name: "Rate Limit Tester",
      email: uniqueEmail(),
      message: "This request should be rate limited.",
      website: "filled-by-a-bot",
      turnstileToken: "test-token",
    },
  });

  expect(blocked.status()).toBe(429);
});

test("contact page works at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/contact");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Contact us");
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("contact form submits successfully in the browser", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  await page.addInitScript(() => {
    let widget = 0;
    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: {
        render: (_element: HTMLElement, options: { callback?: (token: string) => void }) => {
          widget += 1;
          setTimeout(() => options.callback?.("e2e-browser-token"), 0);
          return `e2e-widget-${widget}`;
        },
        remove: () => undefined,
      },
    });
  });
  await page.goto("/contact");

  const submit = page.getByRole("button", { name: "Send message" });
  await expect(submit).toBeEnabled({ timeout: 20_000 });

  await page.getByLabel("Your name").fill("Browser Tester");
  await page.getByLabel("Email address").fill(uniqueEmail());
  await page.getByLabel("Phone or WhatsApp (optional)").fill("+94770000000");
  await page
    .getByLabel("How can we help?")
    .fill("This is a browser contact form test message with enough detail.");

  await submit.click();

  await expect(page.getByRole("status")).toContainText("Message received", { timeout: 20_000 });
});
