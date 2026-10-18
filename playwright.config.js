import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

if (process.env.MENRO_INTEGRATION_TEST !== "true" ||
    process.env.GCLOUD_PROJECT !== "demo-menro-phase2") {
  throw new Error("Playwright integration tests require the demo emulator environment.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
