export const DEMO_PROJECT_ID = "demo-menro-phase2";
export const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
export const LOCAL_API_URL = "http://localhost:5000/api";
export const MPDO_ACCEPTANCE_API_URL = "http://127.0.0.1:5001/api";

export function validateFrontendIntegrationEnvironment(env) {
  const integration = String(env.VITE_USE_FIREBASE_EMULATORS || "").toLowerCase() === "true";
  if (env.VITE_GCS_DEVELOPMENT === "true" && (env.DEV !== true || !integration)) {
    throw new Error("Development GCS requires the Vite development server and demo Auth emulator.");
  }
  if (!integration) return { integration: false };
  if (env.VITE_FIREBASE_PROJECT_ID !== DEMO_PROJECT_ID) {
    throw new Error(`Firebase emulator mode requires project ${DEMO_PROJECT_ID}.`);
  }
  const apiUrl = String(env.VITE_API_URL || "").trim().replace(/\/$/, "");
  const mpdoAcceptance =
    env.VITE_MENRO_MPDO_BOUNDARY_ACCEPTANCE === "true" &&
    env.VITE_MENRO_TEST_BOUNDARY_SOURCE === "mpdo-candidate";
  const requestLetterAcceptance = env.VITE_MENRO_REQUEST_LETTER_ACCEPTANCE === "true";
  if (mpdoAcceptance && requestLetterAcceptance) {
    throw new Error("Frontend integration acceptance gates cannot be combined.");
  }
  const alternateAcceptanceApi =
    (mpdoAcceptance || requestLetterAcceptance) && apiUrl === MPDO_ACCEPTANCE_API_URL;
  if (apiUrl !== LOCAL_API_URL && !alternateAcceptanceApi) {
    throw new Error(`Firebase emulator mode requires API URL ${LOCAL_API_URL}.`);
  }
  return { integration: true, apiUrl, authEmulatorUrl: AUTH_EMULATOR_URL,
    mpdoAcceptance, requestLetterAcceptance };
}

export function assertFrontendIntegrationTokenAudience(token, state) {
  if (!state?.integration) return;
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) throw new Error();
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const claims = JSON.parse(globalThis.atob(padded));
    if (claims?.aud !== DEMO_PROJECT_ID) throw new Error();
  } catch {
    throw new Error("Firebase emulator token project mismatch. Sign out and retry in the isolated test environment.");
  }
}
