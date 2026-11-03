import { describe, expect, it } from "vitest";

import { deriveCsrfToken, hashStoredCsrfToken, verifyCsrfToken } from "@/server/auth/csrf";

describe("CSRF tokens", () => {
  it("derives a stable token per session", () => {
    const sessionA = "session-token-a";
    const sessionB = "session-token-b";

    expect(deriveCsrfToken(sessionA)).toBe(deriveCsrfToken(sessionA));
    expect(deriveCsrfToken(sessionA)).not.toBe(deriveCsrfToken(sessionB));
  });

  it("verifies the expected token and rejects another", () => {
    const token = deriveCsrfToken("session-token-a");
    const stored = hashStoredCsrfToken(token);

    expect(stored).not.toBe(token);
    expect(verifyCsrfToken(token, token)).toBe(true);
    expect(verifyCsrfToken("wrong", token)).toBe(false);
    expect(verifyCsrfToken(null, token)).toBe(false);
  });
});
