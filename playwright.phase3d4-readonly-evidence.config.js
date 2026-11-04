import base from "./playwright.phase3d4-isolated.config.js";
import process from "node:process";
process.env.MENRO_READINESS_EVIDENCE_READ_ONLY_EXPECTED = "true";
export default { ...base, webServer: [
  { ...base.webServer[0], command: base.webServer[0].command.replace("$env:MENRO_PHASE3D4_ACCEPTANCE='true';", "$env:MENRO_PHASE3D4_ACCEPTANCE='true'; $env:MENRO_PHASE3D4_EVIDENCE_READ_ONLY='true';") },
  base.webServer[1],
] };
