const FIREBASE_MESSAGES = {
  "auth/invalid-credential": "Invalid email or password.",
  "auth/user-not-found": "Account not found.",
  "auth/wrong-password": "Incorrect password.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/user-disabled": "This account has been disabled. Please contact the administrator.",
  "auth/too-many-requests": "Too many failed attempts. Please wait a while, then try again.",
  "auth/popup-blocked": "The Google sign-in window was blocked. Allow pop-ups, then try again.",
  "auth/unauthorized-domain": "Google sign-in is not enabled for this website. Please contact the administrator.",
};

const GOOGLE_CANCELLATION_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
]);

export const isGoogleCancellation = (error) =>
  GOOGLE_CANCELLATION_CODES.has(error?.code);

export function getVerificationErrorMessage(error) {
  if (["auth/expired-action-code", "auth/invalid-action-code"].includes(error?.code)) {
    return "This verification link is invalid, expired, or has already been used. Sign in and request a new verification email.";
  }
  return "We could not verify your email right now. Check your connection and try the link again.";
}

export function getAuthErrorMessage(error, { provider = "email", online = true } = {}) {
  if (FIREBASE_MESSAGES[error?.code]) return FIREBASE_MESSAGES[error.code];

  if (error?.code === "auth/network-request-failed") {
    return online
      ? "Unable to reach Firebase Authentication. Check your connection or disable any VPN or ad blocker, then try again."
      : "You appear to be offline. Reconnect to the internet, then try again.";
  }

  if (error?.code === "BACKEND_UNAVAILABLE" || error?.code === "ERR_NETWORK") {
    return "Signed in to Firebase, but the MENRO server could not be reached. Please try again shortly.";
  }

  if (error?.code === "BACKEND_TIMEOUT") {
    return "Signed in to Google, but MENRO verification took too long. Please try again.";
  }

  if (error?.code === "BACKEND_UNAUTHORIZED" || error?.status === 401) {
    return "MENRO could not verify this sign-in. Please sign in again.";
  }

  if (error?.code === "BACKEND_FORBIDDEN" || error?.status === 403) {
    if (/inactive/i.test(error?.message || "")) {
      return "This MENRO account is inactive. Please contact the administrator.";
    }
    if (/verify your email/i.test(error?.message || "")) {
      return "Please verify your email address before continuing.";
    }
    return "This account is not authorized to access the MENRO system.";
  }

  if (error?.code === "BACKEND_RATE_LIMITED" || error?.status === 429) {
    return "Sign in is temporarily limited. Please wait and try again.";
  }

  if (error?.code === "BACKEND_SERVER_ERROR" || error?.status >= 500) {
    return "The MENRO server could not complete sign-in. Please try again shortly.";
  }

  if (error?.message && error?.code === "BACKEND_REJECTED") {
    return error.message;
  }

  return provider === "google"
    ? "Google sign-in failed. Please try again."
    : "Login failed. Please try again.";
}
