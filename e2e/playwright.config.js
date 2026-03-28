// ═══════════════════════════════════════════════════════════════
// e2e/playwright.config.js — Configuración Playwright E2E tests
// ═══════════════════════════════════════════════════════════════

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 1,
  workers: 1, // Sequential to avoid port conflicts
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "cd ../backend && node server.js",
      port: 3001,
      timeout: 10_000,
      reuseExistingServer: true,
      env: {
        NODE_ENV: "test",
        PORT: "3001",
        API_SECRET: "test-secret-key-32chars-minimum",
      },
    },
    {
      command: "cd ../frontend && npx vite --port 3000",
      port: 3000,
      timeout: 15_000,
      reuseExistingServer: true,
    },
  ],
});
