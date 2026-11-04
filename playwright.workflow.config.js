import base from "./playwright.phase3c.config.js";
export default { ...base, testMatch: "workflow-forms.spec.js", timeout: 45000, workers: 1,
  webServer: { ...base.webServer, command: "npx vite --config vite.workflow-test.config.js --host 127.0.0.1 --port 5184" } };
