import "server-only";

import { z } from "zod";

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

const base64Key = z
  .string()
  .min(1, "must not be empty")
  .refine((value) => {
    try {
      return Buffer.from(value, "base64").length === 32;
    } catch {
      return false;
    }
  }, "must decode to exactly 32 bytes");

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PUBLIC_DATABASE_URL: z.string().url(),
  AUTH_DATABASE_URL: z.string().url(),
  ADMIN_DATABASE_URL: z.string().url(),
  IP_HASH_SECRET: z.string().min(32),
  MFA_ENCRYPTION_KEY: base64Key,
  CRON_SECRET: z.string().min(32),
  TRUST_PROXY: z.enum(["none", "cloudflare", "caddy"]).default("none"),
  TURNSTILE_SECRET_KEY: emptyToUndefined(z.string().min(1).optional()),
  ANTHROPIC_API_KEY: emptyToUndefined(z.string().min(1).optional()),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5-5"),
  RESEND_API_KEY: emptyToUndefined(z.string().min(1).optional()),
  EMAIL_FROM: emptyToUndefined(
    z
      .string()
      .min(3)
      .refine((value) => !/[\r\n]/.test(value), "must not contain line breaks")
      .optional(),
  ),
  ADMIN_NOTIFICATION_EMAIL: emptyToUndefined(z.string().email().optional()),
  WHATSAPP_API_TOKEN: emptyToUndefined(z.string().min(1).optional()),
  WHATSAPP_PHONE_NUMBER_ID: emptyToUndefined(z.string().min(1).optional()),
  WHATSAPP_API_VERSION: z.string().min(1).default("v21.0"),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().min(2).default("en"),
  WHATSAPP_ADMIN_TEMPLATE: emptyToUndefined(z.string().min(1).optional()),
  WHATSAPP_CUSTOMER_TEMPLATE: emptyToUndefined(z.string().min(1).optional()),
  EXCHANGE_RATE_API_KEY: emptyToUndefined(z.string().min(1).optional()),
  EXCHANGE_RATE_API_URL: emptyToUndefined(z.string().url().optional()),
  STORAGE_ROOT: z.string().min(1).default("./.data/media"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))]
      .filter(Boolean)
      .join(", ");
    throw new Error(`Invalid server environment configuration: ${names}`);
  }

  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return getServerEnv().NODE_ENV === "production";
}
