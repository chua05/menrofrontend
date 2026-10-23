export const DEMO_PROJECT_ID = "demo-menro-phase2";
export const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
export const LOCAL_API_URL = "http://localhost:5000/api";

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
  if (apiUrl !== LOCAL_API_URL) {
    throw new Error(`Firebase emulator mode requires API URL ${LOCAL_API_URL}.`);
  }
  return { integration: true, apiUrl, authEmulatorUrl: AUTH_EMULATOR_URL };
}
