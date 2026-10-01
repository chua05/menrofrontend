import test from "node:test";
import assert from "node:assert/strict";
import { getAuthErrorMessage, isGoogleCancellation } from "../src/utils/authErrors.js";

test("Google popup cancellation is treated as a user action", () => {
  assert.equal(isGoogleCancellation({ code: "auth/popup-closed-by-user" }), true);
  assert.equal(isGoogleCancellation({ code: "auth/cancelled-popup-request" }), true);
  assert.equal(isGoogleCancellation({ code: "auth/popup-blocked" }), false);
});

test("authentication errors distinguish Firebase, network, and backend rejection", () => {
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
