import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/e2e-results.json" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: process.env.SKIP_AUTH_SETUP
    ? [
        {
          name: "chromium",
          use: {
            ...devices["Desktop Chrome"],
          },
        },
      ]
    : [
        // 認證設定專案（先執行）
        {
          name: "setup",
          testMatch: /.*\.setup\.ts/,
        },
        // 主要測試專案
        {
          name: "chromium",
          use: {
            ...devices["Desktop Chrome"],
            storageState: "tests/e2e/.auth/user.json",
          },
          dependencies: ["setup"],
        },
      ],
  webServer: process.env.SKIP_WEB_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3001",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
