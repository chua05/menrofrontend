import base from "./playwright.workflow.config.js";
export default { ...base, testMatch: "modal-topbar.spec.js", webServer: { ...base.webServer,
  command: "npx vite --config vite.ui-a11y-test.config.js --host 127.0.0.1 --port 5184" } };
