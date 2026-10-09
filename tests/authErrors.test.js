import test from "node:test";
import assert from "node:assert/strict";
import {
  getAuthErrorMessage,
  getVerificationErrorMessage,
  hasNewGoogleSession,
  isGoogleCancellation,
} from "../src/utils/authErrors.js";

test("Google popup cancellation is treated as a user action", () => {
  assert.equal(isGoogleCancellation({ code: "auth/popup-closed-by-user" }), true);
  assert.equal(isGoogleCancellation({ code: "auth/cancelled-popup-request" }), true);
  assert.equal(isGoogleCancellation({ code: "auth/popup-blocked" }), false);
});

test("popup errors are reconciled only when a new Google session was established", () => {
  const googleUser = {
    uid: "google-user",
    providerData: [{ providerId: "google.com" }],
  };
  assert.equal(hasNewGoogleSession(null, googleUser), true);
  assert.equal(hasNewGoogleSession({ uid: "old-user" }, googleUser), true);
  assert.equal(hasNewGoogleSession({ uid: "google-user" }, googleUser), false);
  assert.equal(hasNewGoogleSession(null, {
    uid: "password-user",
    providerData: [{ providerId: "password" }],
  }), false);
  assert.equal(hasNewGoogleSession(null, null), false);
});

test("authentication errors distinguish Firebase, network, and backend rejection", () => {
  assert.equal(
    getAuthErrorMessage({ code: "auth/popup-blocked" }, { provider: "google" }),
    "The Google sign-in window was blocked. Allow pop-ups, then try again."
  );
  assert.equal(
    getAuthErrorMessage({ code: "auth/invalid-credential" }),
    "Invalid email or password."
  );
  assert.match(
    getAuthErrorMessage({ code: "BACKEND_UNAVAILABLE" }),
    /MENRO server could not be reached/i
  );
  assert.match(
    getAuthErrorMessage({ code: "BACKEND_UNAUTHORIZED", status: 401 }),
    /could not verify/i
  );
  assert.match(
    getAuthErrorMessage({ code: "BACKEND_FORBIDDEN", status: 403, message: "User account is inactive." }),
    /inactive/i
  );
  assert.match(
    getAuthErrorMessage({ code: "BACKEND_SERVER_ERROR", status: 500 }),
    /could not complete sign-in/i
  );
});

test("verification action errors are safe and actionable", () => {
  assert.match(
    getVerificationErrorMessage({ code: "auth/expired-action-code" }),
    /expired.*request a new verification email/i,
  );
  assert.doesNotMatch(
    getVerificationErrorMessage({ code: "auth/internal-error", message: "secret details" }),
    /secret details|FirebaseError/i,
  );
});
