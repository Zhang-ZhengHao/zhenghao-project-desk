import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "43123";
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: "test-results/playwright",
  projects: [
    {
      name: "chromium-foundation-desktop",
      use: {
        colorScheme: "light",
        viewport: { height: 1_000, width: 1_440 },
      },
    },
    {
      name: "chromium-foundation-mobile",
      use: {
        colorScheme: "light",
        hasTouch: true,
        isMobile: true,
        viewport: { height: 844, width: 390 },
      },
    },
    {
      name: "chromium-foundation-tablet",
      use: {
        colorScheme: "light",
        viewport: { height: 900, width: 901 },
      },
    },
  ],
  reporter: [["list"]],
  retries: process.env.CI ? 1 : 0,
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL,
    launchOptions:
      executablePath === undefined ? undefined : { executablePath },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer:
    process.env.BASE_URL === undefined
      ? {
          command: "npm run start",
          env: {
            APP_VERSION: "0.1.0-e2e",
            BUILD_SHA: "abcdef0123456789abcdef0123456789abcdef01",
            PORT: port,
          },
          reuseExistingServer: false,
          timeout: 60_000,
          url: `${baseURL}/health`,
        }
      : undefined,
  workers: 1,
});
