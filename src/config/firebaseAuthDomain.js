const enabled = (value) => String(value || "").trim().toLowerCase() === "true";

/**
 * Uses the application's own host for Firebase Auth helper traffic only when
 * the explicitly opt-in same-origin helper deployment is enabled. This keeps
 * existing Firebase-hosted authDomain behavior unchanged by default.
 */
export function resolveFirebaseAuthDomain(environment = {}, locationLike = globalThis.location) {
  const configured = String(environment.VITE_FIREBASE_AUTH_DOMAIN || "").trim();
  if (!enabled(environment.VITE_FIREBASE_SAME_ORIGIN_AUTH_HELPER)) return configured;

  const hostname = String(locationLike?.hostname || "").trim().toLowerCase();
  const protocol = String(locationLike?.protocol || "").trim().toLowerCase();
  const local = hostname === "localhost" || hostname === "127.0.0.1";

  if (!hostname || (!local && protocol !== "https:")) {
    throw new Error("Same-origin Firebase Auth helper requires an HTTPS application origin.");
  }

  return hostname;
}
