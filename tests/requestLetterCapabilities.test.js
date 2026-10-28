import assert from "node:assert/strict";
import test from "node:test";
import {
  legacyRequestLetterMetadata,
  requestLetterClientGateEnabled,
  resolveSecureRequestLetterCapability,
} from "../src/utils/requestLetterCapabilities.js";

test("request-letter upload activates only when client and backend gates are enabled", () => {
  const enabled = { requestLetterStorage: { uploadEnabled: true } };
  const disabled = { requestLetterStorage: { uploadEnabled: false } };
  assert.equal(resolveSecureRequestLetterCapability({ clientEnabled: false, backendCapabilities: disabled }), false);
  assert.equal(resolveSecureRequestLetterCapability({ clientEnabled: false, backendCapabilities: enabled }), false);
  assert.equal(resolveSecureRequestLetterCapability({ clientEnabled: true, backendCapabilities: disabled }), false);
  assert.equal(resolveSecureRequestLetterCapability({ clientEnabled: true, backendCapabilities: enabled }), true);
  assert.equal(resolveSecureRequestLetterCapability({ clientEnabled: true, backendCapabilities: null }), false);
});

test("client gate is fail-closed and accepts only exact true", () => {
  assert.equal(requestLetterClientGateEnabled({}), false);
  assert.equal(requestLetterClientGateEnabled({ VITE_REQUEST_LETTER_STORAGE_ENABLED: "false" }), false);
  assert.equal(requestLetterClientGateEnabled({ VITE_REQUEST_LETTER_STORAGE_ENABLED: "TRUE" }), false);
  assert.equal(requestLetterClientGateEnabled({ VITE_REQUEST_LETTER_STORAGE_ENABLED: "true" }), true);
});

test("legacy mode sends metadata without inventing a private document", () => {
  assert.deepEqual(legacyRequestLetterMetadata({ name: "letter.pdf", type: "application/pdf", size: 12 }), {
    name: "letter.pdf", type: "application/pdf", size: 12,
  });
  assert.equal(legacyRequestLetterMetadata(null), null);
});
