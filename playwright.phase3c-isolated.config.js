import process from "node:process";
process.env.MENRO_PHASE3C_ISOLATED_EMULATORS = "true";
import base from "./playwright.phase3c-real.config.js";
export default { ...base, timeout: 60000, globalTeardown: "./tests/phase3c/realTeardown.js", webServer: [
  { command: "powershell -NoProfile -Command \"$env:MENRO_PHASE3C_ISOLATED_EMULATORS='true'; $env:NODE_PATH='C:\\Users\\chuak\\Desktop\\menrobackend\\node_modules'; node tests/integration/phase3cBrowserServer.js\"", cwd: "C:/Users/chuak/Desktop/menrobackend-phase3b-per-tree-evidence", url: "http://127.0.0.1:5185/", reuseExistingServer: false },
  { command: "npx vite --config vite.phase3c-isolated.config.js --host 127.0.0.1 --port 5186", url: "http://127.0.0.1:5186", reuseExistingServer: false }
] };
