import { describe, expect, it } from "vitest";

import {
  generateToken,
  hashToken,
  hashValue,
  isSameOrigin,
  safeEqual,
} from "@/server/security/request";

describe("security helpers", () => {
  it("hashes values deterministically with domain separation", () => {
    expect(hashValue("127.0.0.1", "ip")).toBe(hashValue("127.0.0.1", "ip"));
    expect(hashValue("127.0.0.1", "ip")).not.toBe(hashValue("127.0.0.1", "user-agent"));
    expect(hashToken("abc")).not.toBe(hashValue("abc", "ip"));
  });

  it("generates distinct high-entropy tokens", () => {
    expect(generateToken()).not.toBe(generateToken());
    expect(generateToken().length).toBeGreaterThanOrEqual(40);
  });

  it("compares equal values and rejects different lengths", () => {
    expect(safeEqual("same", "same")).toBe(true);
    expect(safeEqual("same", "other")).toBe(false);
    expect(safeEqual("short", "longer-value")).toBe(false);
  });

  it("accepts only same-origin headers", () => {
    const base = new Headers({ origin: "http://localhost:3000", "sec-fetch-site": "same-origin" });
    const cross = new Headers({ origin: "https://evil.example", "sec-fetch-site": "cross-site" });
    const missing = new Headers();

    expect(isSameOrigin(base)).toBe(true);
    expect(isSameOrigin(cross)).toBe(false);
    expect(isSameOrigin(missing)).toBe(false);
  });
});
