import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

if (process.env.MENRO_INTEGRATION_TEST !== "true" ||
    process.env.MENRO_MPDO_BOUNDARY_ACCEPTANCE !== "true" ||
    process.env.MENRO_TEST_BOUNDARY_SOURCE !== "mpdo-candidate" ||
    process.env.GCLOUD_PROJECT !== "demo-menro-phase2" ||
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180") {
  throw new Error("MPDO map acceptance requires the exact isolated demo emulator environment.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "mpdo-boundary-maps.spec.js",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "npm start",
      cwd: "../menrobackend",
      url: "http://127.0.0.1:5001/",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...process.env, PORT: "5001" },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174",
      cwd: ".",
      url: "http://127.0.0.1:5174/login",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_USE_FIREBASE_EMULATORS: "true",
        VITE_FIREBASE_PROJECT_ID: "demo-menro-phase2",
        VITE_API_URL: "http://127.0.0.1:5001/api",
        VITE_MENRO_MPDO_BOUNDARY_ACCEPTANCE: "true",
        VITE_MENRO_TEST_BOUNDARY_SOURCE: "mpdo-candidate",
      },
    },
  ],
});
