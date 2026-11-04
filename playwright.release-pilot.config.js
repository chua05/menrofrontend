import base from "./playwright.phase3d4-isolated.config.js";
export default { ...base, testMatch: "permanent-sample-release.spec.js", grep: /pilot/,
  webServer: [
    { ...base.webServer[0], command: base.webServer[0].command.replace("$env:MENRO_PHASE3D4_ACCEPTANCE='true';", "$env:MENRO_PHASE3D4_ACCEPTANCE='true'; $env:MENRO_PERMANENT_SAMPLE_RELEASE_ACCEPTANCE='pilot';") },
    base.webServer[1],
  ],
};
