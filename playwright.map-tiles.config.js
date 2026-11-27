import base from "./playwright.workflow.config.js";
export default { ...base, testMatch: "map-tiles.spec.js", workers: 1, use: { ...base.use, baseURL: "http://127.0.0.1:5186" },
  webServer: { ...base.webServer, url: "http://127.0.0.1:5186", command: "npx vite --config vite.map-tiles-test.config.js --host 127.0.0.1 --port 5186" } };
