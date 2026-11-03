import "server-only";

import pino, { type Logger } from "pino";

import { getServerEnv } from "@/server/env";

let loggerInstance: Logger | undefined;

export function getLogger(): Logger {
  if (loggerInstance) return loggerInstance;

  const env = getServerEnv();
  loggerInstance = pino({
    level: env.LOG_LEVEL,
    base: {
      service: "go-lanka",
      environment: env.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "password",
        "passwordHash",
        "token",
        "sessionToken",
        "csrfToken",
        "authorization",
        "cookie",
        "set-cookie",
        "email",
        "phone",
        "message",
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
      ],
      censor: "[redacted]",
    },
  });

  return loggerInstance;
}

export function logError(error: unknown, context: Record<string, string | number | boolean> = {}) {
  getLogger().error({ err: error, ...context }, "request_failed");
}
