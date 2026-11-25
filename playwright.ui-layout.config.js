import base from "./playwright.workflow.config.js";
export default { ...base, testMatch: "ui-layout.spec.js", webServer: { ...base.webServer, command: "npx vite --config vite.ui-layout-test.config.js --host 127.0.0.1 --port 5184" } };
