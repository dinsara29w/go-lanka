import "server-only";

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

import { getSiteUrl } from "@/lib/site";
import { getServerEnv } from "@/server/env";

export type RequestMetadata = {
  ip: string;
  ipHash: string;
  userAgent: string;
  userAgentHash: string;
  requestId: string;
};

export function hashValue(value: string, purpose: string): string {
  return createHmac("sha256", getServerEnv().IP_HASH_SECRET)
    .update(`${purpose}:${value}`)
    .digest("hex");
}

export function hashToken(token: string): string {
  return createHmac("sha256", getServerEnv().IP_HASH_SECRET).update(`token:${token}`).digest("hex");
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutZone = trimmed.split("%")[0];
  const normalized =
    withoutZone.startsWith("::ffff:") && isIP(withoutZone.slice(7)) === 4
      ? withoutZone.slice(7)
      : withoutZone;
  return isIP(normalized) ? normalized : null;
}

function getClientIp(headers: Headers): string {
  const trustProxy = getServerEnv().TRUST_PROXY;

  if (trustProxy === "cloudflare") {
    return normalizeIp(headers.get("cf-connecting-ip")) ?? "unknown";
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const candidate = trustProxy === "caddy" ? parts.at(-1) : parts[0];
    const normalized = normalizeIp(candidate);
    if (normalized) return normalized;
  }

  return normalizeIp(headers.get("x-real-ip")) ?? "unknown";
}

export function getRequestMetadataFromHeaders(headers: Headers): RequestMetadata {
  const ip = getClientIp(headers);
  const userAgent = headers.get("user-agent")?.slice(0, 512) ?? "";
  return {
    ip,
    ipHash: hashValue(ip, "ip"),
    userAgent,
    userAgentHash: hashValue(userAgent, "user-agent"),
    requestId: randomUUID(),
  };
}

export function getRequestMetadata(request: Request): RequestMetadata {
  return getRequestMetadataFromHeaders(request.headers);
}

export function isSameOrigin(headers: Headers): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }

  const origin = headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === getSiteUrl();
    } catch {
      return false;
    }
  }

  const referer = headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === getSiteUrl();
    } catch {
      return false;
    }
  }

  return false;
}

export function getRequestId(headers: Headers): string {
  return headers.get("x-request-id")?.slice(0, 128) || randomUUID();
}
