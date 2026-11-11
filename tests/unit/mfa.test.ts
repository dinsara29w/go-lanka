import { generate } from "otplib";
import { describe, expect, it } from "vitest";

import {
  createMfaSecret,
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  recoveryCodeMatches,
  verifyTotp,
} from "@/server/auth/mfa";

describe("MFA secret storage", () => {
  it("encrypts and decrypts a TOTP secret", () => {
    const secret = createMfaSecret();
    const encrypted = encryptMfaSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(decryptMfaSecret(encrypted)).toBe(secret);
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptMfaSecret(createMfaSecret());
    // Change the first character of the ciphertext: it always alters a real byte. (The last
    // character can carry unused padding bits, or already be "A", which made this test flaky.)
    const [version, iv, tag, ciphertext] = encrypted.split(".");
    const flipped = `${ciphertext[0] === "A" ? "B" : "A"}${ciphertext.slice(1)}`;
    const tampered = [version, iv, tag, flipped].join(".");

    expect(() => decryptMfaSecret(tampered)).toThrow();
  });
});

describe("TOTP verification", () => {
  it("accepts a valid code and rejects replay", { timeout: 30_000 }, async () => {
    const secret = createMfaSecret();
    const token = await generate({ secret });
    const first = await verifyTotp(secret, token);

    expect(first.valid).toBe(true);
    expect(typeof first.timeStep).toBe("number");

    const replay = await verifyTotp(secret, token, first.timeStep);
    expect(replay.valid).toBe(false);
  });

  it("rejects malformed codes", async () => {
    const secret = createMfaSecret();
    expect((await verifyTotp(secret, "12345")).valid).toBe(false);
    expect((await verifyTotp(secret, "abcdef")).valid).toBe(false);
  });
});

describe("recovery codes", () => {
  it("hashes and matches a one-time code", () => {
    const [code] = generateRecoveryCodes(1);
    expect(code).toBeTruthy();
    const hash = hashRecoveryCode(code!);

    expect(recoveryCodeMatches(code!, hash)).toBe(true);
    expect(recoveryCodeMatches("wrong-code", hash)).toBe(false);
  });
});
