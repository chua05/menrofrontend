import base from "./playwright.phase3c-isolated.config.js";

export default { ...base, testMatch: "phase3d4-real.spec.js", timeout: 120000, workers: 1,
  webServer: [
    { ...base.webServer[0], command: base.webServer[0].command.replace("$env:MENRO_PHASE3C_ISOLATED_EMULATORS='true';", "$env:MENRO_PHASE3C_ISOLATED_EMULATORS='true'; $env:MENRO_PHASE3D4_ACCEPTANCE='true';") },
    { ...base.webServer[1], command: base.webServer[1].command.replace("vite.phase3c-isolated.config.js", "vite.phase3d4-isolated.config.js") },
  ],
};
