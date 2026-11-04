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

test("Phase 3C browser acceptance permits only its explicit isolated loopback topology", () => {
  const phase3c = {
    ...valid(),
    VITE_API_URL: "http://127.0.0.1:5185/api",
    VITE_PHASE3C_BROWSER_ACCEPTANCE: "true",
    VITE_PHASE3C_AUTH_EMULATOR_URL: "http://127.0.0.1:9099",
    VITE_PHASE3C_FIRESTORE_EMULATOR_HOST: "127.0.0.1:8181",
    VITE_PHASE3C_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  };
  const state = validateFrontendIntegrationEnvironment(phase3c);
  assert.equal(state.apiUrl, "http://127.0.0.1:5185/api");
  assert.equal(state.phase3cBrowserAcceptance, true);
  for (const [key, value] of [
    ["VITE_PHASE3C_BROWSER_ACCEPTANCE", "false"],
    ["VITE_PHASE3C_AUTH_EMULATOR_URL", "http://127.0.0.1:9098"],
    ["VITE_PHASE3C_FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080"],
    ["VITE_PHASE3C_STORAGE_EMULATOR_HOST", "127.0.0.1:9198"],
    ["VITE_FIREBASE_PROJECT_ID", "menrosystem-ddfac"],
    ["VITE_API_URL", "https://example.invalid/api"],
    ["VITE_API_URL", "http://127.0.0.1:5186/api"],
  ]) {
    assert.throws(() => validateFrontendIntegrationEnvironment({ ...phase3c, [key]: value }));
  }
});
test("Phase 3C isolated emulator ports require the complete explicit topology", () => {
  const isolated = { ...valid(), VITE_FIREBASE_PROJECT_ID: "demo-menro-phase3c-isolated", VITE_API_URL: "http://127.0.0.1:5185/api", VITE_PHASE3C_BROWSER_ACCEPTANCE: "true",
    VITE_FIREBASE_STORAGE_BUCKET: "demo-menro-phase3c-isolated.firebasestorage.app",
    VITE_PHASE3C_ISOLATED_EMULATORS: "true", VITE_PHASE3C_AUTH_EMULATOR_URL: "http://127.0.0.1:9299",
    VITE_PHASE3C_FIRESTORE_EMULATOR_HOST: "127.0.0.1:8281", VITE_PHASE3C_STORAGE_EMULATOR_HOST: "127.0.0.1:9298" };
  const state = validateFrontendIntegrationEnvironment(isolated);
  assert.equal(state.phase3cIsolated, true);
  assert.equal(state.authEmulatorUrl, "http://127.0.0.1:9299");
  for (const change of [{ VITE_PHASE3C_ISOLATED_EMULATORS: undefined }, { VITE_PHASE3C_AUTH_EMULATOR_URL: "http://127.0.0.1:9099" },
    { VITE_PHASE3C_FIRESTORE_EMULATOR_HOST: "example.invalid:8281" }, { VITE_PHASE3C_STORAGE_EMULATOR_HOST: "127.0.0.1:9199" },
    { VITE_FIREBASE_PROJECT_ID: "production-project" }, { VITE_FIREBASE_PROJECT_ID: "demo-menro-phase2" },
    { VITE_FIREBASE_STORAGE_BUCKET: "demo-menro-phase2.firebasestorage.app" }, { VITE_FIREBASE_STORAGE_BUCKET: undefined },
    { VITE_PHASE3C_BROWSER_ACCEPTANCE: undefined }, { VITE_API_URL: "http://localhost:5000/api" },
    { VITE_USE_FIREBASE_EMULATORS: "false" }, { PROD: true }]) assert.throws(() => validateFrontendIntegrationEnvironment({ ...isolated, ...change }));
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

test("isolated emulator HTTP tokens require the isolated demo project", () => {
  const state = validateFrontendIntegrationEnvironment({
    ...valid(),
    VITE_FIREBASE_PROJECT_ID: "demo-menro-phase3c-isolated",
    VITE_FIREBASE_STORAGE_BUCKET: "demo-menro-phase3c-isolated.firebasestorage.app",
    VITE_API_URL: "http://127.0.0.1:5185/api",
    VITE_PHASE3C_BROWSER_ACCEPTANCE: "true",
    VITE_PHASE3C_ISOLATED_EMULATORS: "true",
    VITE_PHASE3C_AUTH_EMULATOR_URL: "http://127.0.0.1:9299",
    VITE_PHASE3C_FIRESTORE_EMULATOR_HOST: "127.0.0.1:8281",
    VITE_PHASE3C_STORAGE_EMULATOR_HOST: "127.0.0.1:9298",
  });
  assert.doesNotThrow(() => assertFrontendIntegrationTokenAudience(jwt({ aud: "demo-menro-phase3c-isolated" }), state));
  assert.throws(() => assertFrontendIntegrationTokenAudience(jwt({ aud: "demo-menro-phase2" }), state), /project mismatch/);
});
