import "server-only";

import { hash, parseOptions, verify, type Algorithm } from "@node-rs/argon2";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

// 2 is Argon2id. The package's const enum is not available at runtime.
const ARGON2ID = 2 as Algorithm;

const ARGON2_OPTIONS = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
  algorithm: ARGON2ID,
} as const;

// A valid hash used only to keep unknown-account login attempts roughly
// equivalent in cost to known-account attempts.
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$TntfKZpuRh2nS9dF7oXyKA$99k8lBH7MCqSEDjSuFJ/WY8tgGjnKVAR7En3ra8IPwY";

const COMMON_PASSWORDS = new Set([
  "123456789012",
  "password1234",
  "password12345",
  "qwertyuiop12",
  "letmein12345",
  "adminadmin12",
  "welcome12345",
  "iloveyou1234",
]);

export function validatePassword(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (password.trim().length === 0) {
    return "Password must not be only whitespace.";
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "Choose a less common password.";
  }

  if (email) {
    const localPart = email.split("@")[0]?.toLowerCase();
    if (localPart && localPart.length >= 4 && password.toLowerCase().includes(localPart)) {
      return "Password must not contain your email address.";
    }
  }

  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function verifyDummyPassword(password: string): Promise<void> {
  await verifyPassword(DUMMY_PASSWORD_HASH, password);
}

export function passwordNeedsRehash(passwordHash: string): boolean {
  try {
    const options = parseOptions(passwordHash);
    return (
      options.algorithm !== ARGON2ID ||
      options.memoryCost !== ARGON2_OPTIONS.memoryCost ||
      options.timeCost !== ARGON2_OPTIONS.timeCost ||
      options.parallelism !== ARGON2_OPTIONS.parallelism ||
      options.outputLen !== ARGON2_OPTIONS.outputLen
    );
  } catch {
    return true;
  }
}
