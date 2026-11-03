import "server-only";

import { cookies } from "next/headers";

import { decryptMfaSecret, encryptMfaSecret } from "@/server/auth/mfa";
import { getServerEnv } from "@/server/env";

function cookieName(): string {
  return getServerEnv().NODE_ENV === "production"
    ? "__Host-gl_setup_recovery"
    : "gl_setup_recovery";
}

function options() {
  return {
    httpOnly: true,
    secure: getServerEnv().NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 10 * 60,
    priority: "high" as const,
  };
}

export async function setSetupRecoveryCodes(codes: string[]): Promise<void> {
  const store = await cookies();
  store.set(cookieName(), encryptMfaSecret(JSON.stringify(codes)), options());
}

export async function readSetupRecoveryCodes(): Promise<string[] | null> {
  const store = await cookies();
  const payload = store.get(cookieName())?.value;
  if (!payload) return null;

  try {
    const parsed: unknown = JSON.parse(decryptMfaSecret(payload));
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      parsed.length > 20 ||
      !parsed.every((code) => typeof code === "string" && code.length <= 30)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSetupRecoveryCodes(): Promise<void> {
  const store = await cookies();
  store.set(cookieName(), "", { ...options(), maxAge: 0 });
}
