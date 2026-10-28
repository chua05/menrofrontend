import test from "node:test";
import assert from "node:assert/strict";
import {
  assertFrontendIntegrationTokenAudience,
  validateFrontendIntegrationEnvironment,
} from "../src/config/integrationEnvironment.js";

const valid = () => ({ VITE_USE_FIREBASE_EMULATORS: "true",
  VITE_FIREBASE_PROJECT_ID: "demo-menro-phase2", VITE_API_URL: "http://localhost:5000/api" });

test("frontend emulator mode accepts only the demo project and local API", () => {
  assert.equal(validateFrontendIntegrationEnvironment(valid()).integration, true);
  assert.throws(() => validateFrontendIntegrationEnvironment({ ...valid(), VITE_FIREBASE_PROJECT_ID: "menrosystem-ddfac" }), /requires project/);
  assert.throws(() => validateFrontendIntegrationEnvironment({ ...valid(), VITE_API_URL: "https://menrobk-1.onrender.com/api" }), /requires API URL/);
});

test("MPDO acceptance API port requires the explicit candidate gate", () => {
  const mpdo = {
    ...valid(),
    VITE_API_URL: "http://127.0.0.1:5001/api",
    VITE_MENRO_MPDO_BOUNDARY_ACCEPTANCE: "true",
    VITE_MENRO_TEST_BOUNDARY_SOURCE: "mpdo-candidate",
  };
  assert.equal(validateFrontendIntegrationEnvironment(mpdo).mpdoAcceptance, true);
  assert.throws(
    () => validateFrontendIntegrationEnvironment({ ...mpdo, VITE_MENRO_MPDO_BOUNDARY_ACCEPTANCE: "false" }),
    /requires API URL/,
  );
  assert.throws(
    () => validateFrontendIntegrationEnvironment({ ...mpdo, VITE_MENRO_TEST_BOUNDARY_SOURCE: "runtime" }),
    /requires API URL/,
  );
});

test("request-letter acceptance may use port 5001 only with its explicit gate", () => {
  const requestLetter = {
    ...valid(),
    VITE_API_URL: "http://127.0.0.1:5001/api",
    VITE_MENRO_REQUEST_LETTER_ACCEPTANCE: "true",
  };
  const state = validateFrontendIntegrationEnvironment(requestLetter);
  assert.equal(state.requestLetterAcceptance, true);
  assert.equal(state.apiUrl, "http://127.0.0.1:5001/api");
  assert.throws(
    () => validateFrontendIntegrationEnvironment({ ...requestLetter,
      VITE_MENRO_REQUEST_LETTER_ACCEPTANCE: "false" }),
    /requires API URL/,
  );
  assert.throws(
    () => validateFrontendIntegrationEnvironment({ ...requestLetter,
      VITE_MENRO_MPDO_BOUNDARY_ACCEPTANCE: "true",
      VITE_MENRO_TEST_BOUNDARY_SOURCE: "mpdo-candidate" }),
    /cannot be combined/,
  );
});

test("normal frontend mode remains unchanged", () => {
  assert.deepEqual(validateFrontendIntegrationEnvironment({}), { integration: false });
});

test("GCS development rejects production Auth before Firebase client initialization", () => {
  assert.throws(() => validateFrontendIntegrationEnvironment({ VITE_GCS_DEVELOPMENT: "true", DEV: true }));
  assert.throws(() => validateFrontendIntegrationEnvironment({ ...valid(), VITE_GCS_DEVELOPMENT: "true", DEV: false }));
  assert.equal(validateFrontendIntegrationEnvironment({ ...valid(), VITE_GCS_DEVELOPMENT: "true", DEV: true }).integration, true);
});

const jwt = (claims) => ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".");

test("emulator HTTP tokens fail locally before backend submission on project mismatch", () => {
  const state = validateFrontendIntegrationEnvironment(valid());
  assert.doesNotThrow(() => assertFrontendIntegrationTokenAudience(jwt({ aud: "demo-menro-phase2" }), state));
  assert.throws(
    () => assertFrontendIntegrationTokenAudience(jwt({ aud: "menrosystem-ddfac" }), state),
    /emulator token project mismatch/,
  );
  assert.throws(() => assertFrontendIntegrationTokenAudience("not-a-token", state), /project mismatch/);
  assert.doesNotThrow(() => assertFrontendIntegrationTokenAudience("not-a-token", { integration: false }));
});
