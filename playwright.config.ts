import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [["list"]],
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:3100",
    locale: "ar-EG",
    timezoneId: "Africa/Cairo",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: "node node_modules/next/dist/bin/next start -p 3100 -H 127.0.0.1",
          url: "http://127.0.0.1:3100/api/health",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
