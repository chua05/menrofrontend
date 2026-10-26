import test from "node:test";
import assert from "node:assert/strict";
import { validateFrontendIntegrationEnvironment } from "../src/config/integrationEnvironment.js";

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

test("normal frontend mode remains unchanged", () => {
  assert.deepEqual(validateFrontendIntegrationEnvironment({}), { integration: false });
});

test("GCS development rejects production Auth before Firebase client initialization", () => {
  assert.throws(() => validateFrontendIntegrationEnvironment({ VITE_GCS_DEVELOPMENT: "true", DEV: true }));
  assert.throws(() => validateFrontendIntegrationEnvironment({ ...valid(), VITE_GCS_DEVELOPMENT: "true", DEV: false }));
  assert.equal(validateFrontendIntegrationEnvironment({ ...valid(), VITE_GCS_DEVELOPMENT: "true", DEV: true }).integration, true);
});
