import base from "./playwright.phase3c-isolated.config.js";
export default { ...base, testMatch: "workflow-real.spec.js", timeout: 120000, workers: 1,
  webServer: [ { ...base.webServer[0], command: base.webServer[0].command.replace("node tests/integration/phase3cBrowserServer.js", "$env:MENRO_COMBINED_WORKFLOW_ACCEPTANCE='true'; node tests/integration/phase3cBrowserServer.js") }, base.webServer[1] ] };
