import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against the production build, not `next dev`.
 *
 * Dev-mode HMR injects its own scripts and a websocket that fails under a
 * headless harness, producing console errors that are not the app's. Testing
 * what actually ships is the point.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  outputDir: "test-results",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
