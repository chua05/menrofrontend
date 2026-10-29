import test from "node:test";
import assert from "node:assert/strict";
import {
  GOOGLE_POPUP_COMPLETION_TIMEOUT_CODE,
  waitForGooglePopupCompletion,
} from "../src/utils/googlePopupRecovery.js";

test("Google popup completion resolves before its timeout", async () => {
  await assert.doesNotReject(
    waitForGooglePopupCompletion(Promise.resolve({ user: { uid: "demo-user" } }), 20),
  );
});

test("Google popup completion returns a recoverable error when no callback returns", async () => {
  await assert.rejects(
    waitForGooglePopupCompletion(new Promise(() => {}), 5),
    (error) => error.code === GOOGLE_POPUP_COMPLETION_TIMEOUT_CODE,
  );
});
