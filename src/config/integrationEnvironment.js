export const DEMO_PROJECT_ID = "demo-menro-phase2";
const PHASE3C_ISOLATED_PROJECT_ID = "demo-menro-phase3c-isolated";
export const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
export const LOCAL_API_URL = "http://localhost:5000/api";
export const MPDO_ACCEPTANCE_API_URL = "http://127.0.0.1:5001/api";
export const PHASE3C_BROWSER_ACCEPTANCE_API_URL = "http://127.0.0.1:5185/api";
const PHASE3C_AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
const PHASE3C_FIRESTORE_EMULATOR_HOST = "127.0.0.1:8181";
const PHASE3C_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const PHASE3C_ISOLATED_AUTH_EMULATOR_URL = "http://127.0.0.1:9299";
const PHASE3C_ISOLATED_FIRESTORE_EMULATOR_HOST = "127.0.0.1:8281";
const PHASE3C_ISOLATED_STORAGE_EMULATOR_HOST = "127.0.0.1:9298";

export function validateFrontendIntegrationEnvironment(env) {
  const integration = String(env.VITE_USE_FIREBASE_EMULATORS || "").toLowerCase() === "true";
  const phase3cIsolated = env.VITE_PHASE3C_ISOLATED_EMULATORS === "true";
  if (phase3cIsolated && (!integration || env.PROD === true)) {
    throw new Error("Isolated Phase 3C emulators require the local test server and emulator mode.");
  }
  if (env.VITE_GCS_DEVELOPMENT === "true" && (env.DEV !== true || !integration)) {
    throw new Error("Development GCS requires the Vite development server and demo Auth emulator.");
  }
  if (!integration) return { integration: false };
  const apiUrl = String(env.VITE_API_URL || "").trim().replace(/\/$/, "");
  const mpdoAcceptance =
    env.VITE_MENRO_MPDO_BOUNDARY_ACCEPTANCE === "true" &&
    env.VITE_MENRO_TEST_BOUNDARY_SOURCE === "mpdo-candidate";
  const requestLetterAcceptance = env.VITE_MENRO_REQUEST_LETTER_ACCEPTANCE === "true";
  const phase3cBrowserAcceptance = env.VITE_PHASE3C_BROWSER_ACCEPTANCE === "true";
  const requiredProject = phase3cIsolated ? PHASE3C_ISOLATED_PROJECT_ID : DEMO_PROJECT_ID;
  if (env.VITE_FIREBASE_PROJECT_ID !== requiredProject) throw new Error(`Firebase emulator mode requires project ${requiredProject}.`);
  if (mpdoAcceptance && requestLetterAcceptance) {
    throw new Error("Frontend integration acceptance gates cannot be combined.");
  }
  const alternateAcceptanceApi =
    (mpdoAcceptance || requestLetterAcceptance) && apiUrl === MPDO_ACCEPTANCE_API_URL;
  const phase3cBrowserApi = !phase3cIsolated && phase3cBrowserAcceptance && apiUrl === PHASE3C_BROWSER_ACCEPTANCE_API_URL &&
    env.VITE_PHASE3C_AUTH_EMULATOR_URL === PHASE3C_AUTH_EMULATOR_URL &&
    env.VITE_PHASE3C_FIRESTORE_EMULATOR_HOST === PHASE3C_FIRESTORE_EMULATOR_HOST &&
    env.VITE_PHASE3C_STORAGE_EMULATOR_HOST === PHASE3C_STORAGE_EMULATOR_HOST;
  const phase3cIsolatedApi = phase3cBrowserAcceptance && phase3cIsolated && apiUrl === PHASE3C_BROWSER_ACCEPTANCE_API_URL &&
    env.VITE_PHASE3C_AUTH_EMULATOR_URL === PHASE3C_ISOLATED_AUTH_EMULATOR_URL &&
    env.VITE_PHASE3C_FIRESTORE_EMULATOR_HOST === PHASE3C_ISOLATED_FIRESTORE_EMULATOR_HOST &&
    env.VITE_PHASE3C_STORAGE_EMULATOR_HOST === PHASE3C_ISOLATED_STORAGE_EMULATOR_HOST;
  if (phase3cIsolated && (!phase3cIsolatedApi || mpdoAcceptance || requestLetterAcceptance ||
      env.VITE_FIREBASE_STORAGE_BUCKET !== `${PHASE3C_ISOLATED_PROJECT_ID}.firebasestorage.app`)) {
    throw new Error("Isolated Phase 3C emulators require the complete approved project, bucket, API and emulator topology.");
  }
  if (apiUrl !== LOCAL_API_URL && !alternateAcceptanceApi && !phase3cBrowserApi && !phase3cIsolatedApi) {
    throw new Error(`Firebase emulator mode requires API URL ${LOCAL_API_URL}.`);
  }
  return { integration: true, apiUrl, authEmulatorUrl: phase3cIsolatedApi ? PHASE3C_ISOLATED_AUTH_EMULATOR_URL : AUTH_EMULATOR_URL,
    mpdoAcceptance, requestLetterAcceptance, phase3cBrowserAcceptance: phase3cBrowserApi || phase3cIsolatedApi, phase3cIsolated: phase3cIsolatedApi };
}

export function assertFrontendIntegrationTokenAudience(token, state) {
  if (!state?.integration) return;
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) throw new Error();
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const claims = JSON.parse(globalThis.atob(padded));
    const expectedProject = state?.phase3cIsolated
      ? PHASE3C_ISOLATED_PROJECT_ID
      : DEMO_PROJECT_ID;
    if (claims?.aud !== expectedProject) throw new Error();
  } catch {
    throw new Error("Firebase emulator token project mismatch. Sign out and retry in the isolated test environment.");
  }
}
