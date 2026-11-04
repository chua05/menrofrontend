import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests/e2e", testMatch: "phase3c-routing.spec.js", use: { baseURL: "http://127.0.0.1:5184" }, webServer: { command: "npx vite --config vite.phase3c-test.config.js --host 127.0.0.1 --port 5184", url: "http://127.0.0.1:5184", reuseExistingServer: false } });
