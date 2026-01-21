import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/api/**/*.test.ts",
      "tests/services/**/*.test.ts",
      "tests/slack-bot/**/*.test.ts",
      "tests/queue-worker/**/*.test.ts",
      "tests/shared/**/*.test.ts",
    ],
    exclude: ["tests/e2e/**/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: [
        "packages/api/src/**/*.ts",
        "packages/services/src/**/*.ts",
        "packages/shared/src/**/*.ts",
        "apps/slack-bot/src/**/*.ts",
        "apps/queue-worker/src/**/*.ts",
      ],
      exclude: ["**/node_modules/**", "**/tests/**"],
    },
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    isolate: true,
    pool: "forks",
  },
  resolve: {
    alias: {
      "@Sales_ai_automation_v3/db": path.resolve(__dirname, "packages/db/src"),
      "@Sales_ai_automation_v3/auth": path.resolve(
        __dirname,
        "packages/auth/src"
      ),
      "@Sales_ai_automation_v3/services": path.resolve(
        __dirname,
        "packages/services/src"
      ),
      "@Sales_ai_automation_v3/shared": path.resolve(
        __dirname,
        "packages/shared/src"
      ),
    },
  },
});
