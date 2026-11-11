import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

import { getServerEnv } from "@/server/env";
import { hashValue, safeEqual } from "@/server/security/request";

const MFA_AAD = Buffer.from("go-lanka:mfa:v1", "utf8");
const TOTP_PERIOD_SECONDS = 30;
const TOTP_TOLERANCE_SECONDS = 30;

function encryptionKey(): Buffer {
  const key = Buffer.from(getServerEnv().MFA_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("MFA encryption key must be 32 bytes");
  }
  return key;
}

export function createMfaSecret(): string {
  return generateSecret();
}

export function encryptMfaSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(MFA_AAD);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptMfaSecret(payload: string): string {
  const [version, ivPart, tagPart, ciphertextPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error("Invalid MFA secret payload");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAAD(MFA_AAD);
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function buildMfaUri(secret: string, email: string): string {
  return generateURI({
    strategy: "totp",
    issuer: "Go Lanka",
    label: email,
    secret,
    period: TOTP_PERIOD_SECONDS,
  });
}

export async function buildMfaQrDataUrl(secret: string, email: string): Promise<string> {
  return QRCode.toDataURL(buildMfaUri(secret, email), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
  });
}

export async function verifyTotp(
  secret: string,
  token: string,
  afterTimeStep?: number | null,
): Promise<{ valid: boolean; timeStep?: number }> {
  if (!/^\d{6}$/.test(token)) return { valid: false };

  try {
    const result = await verify({
      secret,
      token,
      epochTolerance: TOTP_TOLERANCE_SECONDS,
      afterTimeStep: afterTimeStep ?? undefined,
    });

    if (!result.valid) return { valid: false };
    if ("timeStep" in result && typeof result.timeStep === "number") {
      return { valid: true, timeStep: result.timeStep };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(9).toString("base64url").slice(0, 12);
    return raw.match(/.{1,4}/g)?.join("-") ?? raw;
  });
}

export function hashRecoveryCode(code: string): string {
  return hashValue(code.trim().toLowerCase(), "mfa-recovery");
}

export function recoveryCodeMatches(code: string, hash: string): boolean {
  return safeEqual(hashRecoveryCode(code), hash);
}
