// Sidebar layout audit: sweeps sidebar-layout-audit.spec.js across roles, pages and viewport widths to check
// docked, rail and drawer geometry. It is kept out of the ui-a11y suite because of its runtime (about 10 minutes)
// and because it serves the app with a placeholder MapTiler key (vite.sidebar-audit-test.config.js).
// Run: npx playwright test -c playwright.sidebar-audit.config.js
import base from "./playwright.ui-a11y.config.js";
export default { ...base, testMatch: "sidebar-layout-audit.spec.js",
  webServer: { ...base.webServer, command: "npx vite --config vite.sidebar-audit-test.config.js --host 127.0.0.1 --port 5184" } };
