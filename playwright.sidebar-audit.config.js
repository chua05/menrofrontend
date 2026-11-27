import base from "./playwright.ui-a11y.config.js";
export default { ...base, testMatch: "sidebar-layout-audit.spec.js",
  webServer: { ...base.webServer, command: "npx vite --config vite.sidebar-audit-test.config.js --host 127.0.0.1 --port 5184" } };
