import base from "./playwright.workflow.config.js";
export default { ...base, testMatch: "login-corrections.spec.js", webServer: { ...base.webServer,
  command: "npx vite --config vite.login-test.config.js --host 127.0.0.1 --port 5184" } };
