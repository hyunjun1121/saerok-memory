import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-portrait",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 540, height: 960 },
        deviceScaleFactor: 2,
        hasTouch: false,
        isMobile: false,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run build:ko && npm run preview:ko",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
