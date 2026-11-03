import "server-only";

import { z } from "zod";

import { getSiteUrl, isLocalSiteUrl } from "@/lib/site";
import { getServerEnv } from "@/server/env";

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

export async function verifyTurnstile(input: {
  token: string | null | undefined;
  ip: string;
  action: string;
}): Promise<boolean> {
  const env = getServerEnv();
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret || !input.token) return false;

  const isCloudflareTestSecret = secret === "1x0000000000000000000000000000000AA";
  const testSecretAllowed =
    isCloudflareTestSecret && (env.NODE_ENV !== "production" || isLocalSiteUrl());
  if (isCloudflareTestSecret && !testSecretAllowed) return false;

  const body = new URLSearchParams({
    secret,
    response: input.token,
    remoteip: input.ip,
  });

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });

    if (!response.ok) return false;

    const parsed = turnstileResponseSchema.safeParse(await response.json());
    if (!parsed.success || !parsed.data.success) return false;
    if (parsed.data.action && parsed.data.action !== input.action) return false;

    if (parsed.data.hostname && !isCloudflareTestSecret) {
      const expectedHostname = new URL(getSiteUrl()).hostname;
      if (parsed.data.hostname !== expectedHostname) return false;
    }

    return true;
  } catch {
    return false;
  }
}
