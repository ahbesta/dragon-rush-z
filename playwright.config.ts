import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      process.env.E2E_SERVER_COMMAND ?? `npm run dev -- --port ${new URL(baseURL).port || "3000"}`,
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
