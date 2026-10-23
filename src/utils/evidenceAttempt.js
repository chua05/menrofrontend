import { validateFrontendIntegrationEnvironment } from "../config/integrationEnvironment.js";

// Explicit form intent, not payload-based cross-request deduplication. No Storage credentials.
export function createEvidenceAttempt(env = import.meta.env || {}, newKey = () => crypto.randomUUID()) {
  const enabled = env.VITE_GCS_DEVELOPMENT === "true";
  if (enabled && (env.DEV !== true || !validateFrontendIntegrationEnvironment(env).integration)) {
    throw new Error("Development evidence retries require the local demo Auth emulator and API.");
  }
  let key;
  return {
    enabled,
    headers(preferredKey) {
      if (!enabled) return {};
      key ||= preferredKey || newKey();
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
