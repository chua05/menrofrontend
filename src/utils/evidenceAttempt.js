import { validateFrontendIntegrationEnvironment } from "../config/integrationEnvironment.js";
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
export function createIdempotencyKey() { if (typeof crypto?.randomUUID === "function") return crypto.randomUUID(); const bytes = new Uint8Array(16); crypto.getRandomValues(bytes); return `menro_${Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("")}`; }

// Explicit form intent, not payload-based cross-request deduplication. No Storage credentials.
export function createEvidenceAttempt(env = import.meta.env || {}, newKey = createIdempotencyKey) {
  const developmentMode = env.VITE_GCS_DEVELOPMENT === "true";
  const enabled = developmentMode || env.VITE_EVIDENCE_CLOUD_WORKFLOW_ENABLED === "true";
  if (developmentMode && (env.DEV !== true || !validateFrontendIntegrationEnvironment(env).integration)) {
    throw new Error("Development evidence retries require the local demo Auth emulator and API.");
  }
  let key;
  return {
    enabled,
    headers(preferredKey) {
      if (!enabled) return {};
      key ||= preferredKey || newKey();
      if (typeof key !== "string" || !KEY_PATTERN.test(key)) throw new Error("Unable to create a valid submission key. Please try again.");
      return { "Idempotency-Key": key };
    },
    reset() { key = undefined; },
  };
}

export function assertEvidenceComplete(response, payload, headers) {
  if (headers?.["Idempotency-Key"] && (response.status === 202 || payload?.success === false && response.ok)) {
    throw new Error("Evidence processing is still pending. Keep this form open and retry the same submission without changing its fields or photos.");
  }
}
