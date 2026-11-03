import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src,
      "server-only": serverOnlyStub,
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    env: {
      NODE_ENV: "test",
      PUBLIC_DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
      AUTH_DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
      ADMIN_DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
      IP_HASH_SECRET: "test-ip-hash-secret-that-is-long-enough-123456",
      MFA_ENCRYPTION_KEY: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=",
      CRON_SECRET: "test-cron-secret-that-is-long-enough-123456",
      TRUST_PROXY: "none",
      LOG_LEVEL: "silent",
      STORAGE_ROOT: "./.data/test-media",
    },
  },
});
