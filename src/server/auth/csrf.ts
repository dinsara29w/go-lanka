import "server-only";

import { headers } from "next/headers";

import { hashValue, isSameOrigin, safeEqual } from "@/server/security/request";

/**
 * The CSRF token is derived from the HttpOnly session token. The browser can
 * see the derived value in forms, but a cross-site attacker cannot read the
 * session cookie and therefore cannot derive it.
 */
export function deriveCsrfToken(sessionToken: string): string {
  return hashValue(sessionToken, "csrf-token");
}

export function hashStoredCsrfToken(csrfToken: string): string {
  return hashValue(csrfToken, "csrf-stored");
}

export function verifyCsrfToken(submitted: string | null | undefined, expected: string): boolean {
  if (!submitted) return false;
  return safeEqual(submitted, expected);
}

export async function assertSameOriginRequest(): Promise<void> {
  const requestHeaders = await headers();
  if (!isSameOrigin(requestHeaders)) {
    throw new Error("Invalid request origin");
  }
}
