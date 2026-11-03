import { describe, expect, it } from "vitest";

import {
  hashPassword,
  passwordNeedsRehash,
  validatePassword,
  verifyDummyPassword,
  verifyPassword,
} from "@/server/auth/password";

describe("password policy", () => {
  it("rejects short passwords", () => {
    expect(validatePassword("short")).toMatch(/at least/);
  });

  it("rejects common passwords", () => {
    expect(validatePassword("password1234")).toMatch(/common/);
  });

  it("rejects passwords containing the email local part", () => {
    expect(validatePassword("owner-owner-1234", "owner@example.com")).toMatch(/email/);
  });

  it("accepts a long passphrase", () => {
    expect(validatePassword("correct horse battery staple", "owner@example.com")).toBeNull();
  });
});

describe("password hashing", () => {
  it("hashes and verifies a password", { timeout: 30_000 }, async () => {
    const password = "a-long-test-passphrase";
    const result = await hashPassword(password);

    expect(result).not.toContain(password);
    expect(await verifyPassword(result, password)).toBe(true);
    expect(await verifyPassword(result, "wrong-password")).toBe(false);
  });

  it("does not need rehashing with current parameters", { timeout: 30_000 }, async () => {
    const result = await hashPassword("a-long-test-passphrase");
    expect(passwordNeedsRehash(result)).toBe(false);
  });

  it("runs the dummy verification path", { timeout: 30_000 }, async () => {
    await expect(verifyDummyPassword("anything")).resolves.toBeUndefined();
  });
});
