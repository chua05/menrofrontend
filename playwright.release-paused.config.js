import process from "node:process";
import base from "./playwright.phase3d4-isolated.config.js";
process.env.MENRO_RELEASE_PAUSE_EXPECTED = "true";
export default { ...base, testMatch: "permanent-sample-release.spec.js", grep: /paused/,
  webServer: [
    { ...base.webServer[0], command: base.webServer[0].command.replace("$env:MENRO_PHASE3D4_ACCEPTANCE='true';", "$env:MENRO_PHASE3D4_ACCEPTANCE='true'; $env:MENRO_PERMANENT_SAMPLE_RELEASE_ACCEPTANCE='paused';") },
    base.webServer[1],
  ],
};
