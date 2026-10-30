import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createEvidenceAttempt, assertEvidenceComplete } from "../src/utils/evidenceAttempt.js";
const env = { DEV: true, VITE_GCS_DEVELOPMENT: "true", VITE_USE_FIREBASE_EMULATORS: "true",
  VITE_FIREBASE_PROJECT_ID: "demo-menro-phase2", VITE_API_URL: "http://localhost:5000/api" };
test("normal production and local requests remain header-free", () => {
  const attempt = createEvidenceAttempt({}, () => { throw Error("must not generate"); });
  assert.deepEqual(attempt.headers(), {});
});
test("production cloud workflow sends a stable contract-valid key", () => {
  const attempt = createEvidenceAttempt({ VITE_EVIDENCE_CLOUD_WORKFLOW_ENABLED: "true" }, () => "planting_retry-key_2026");
  assert.deepEqual(attempt.headers(), { "Idempotency-Key": "planting_retry-key_2026" });
  assert.deepEqual(attempt.headers(), { "Idempotency-Key": "planting_retry-key_2026" });
});
for (const changes of [{ DEV: false }, { VITE_USE_FIREBASE_EMULATORS: "false" },
  { VITE_FIREBASE_PROJECT_ID: "menrosystem-ddfac" }, { VITE_API_URL: "https://example.invalid/api" }]) {
  test(`development retry mode rejects ${JSON.stringify(changes)}`, () => {
    assert.throws(() => createEvidenceAttempt({ ...env, ...changes }));
  });
}
test("retries reuse one explicit intent; success or cancellation resets it", () => {
  let sequence = 0;
  const attempt = createEvidenceAttempt(env, () => `synthetic-key-${++sequence}`);
  const headers = attempt.headers();
  assert.deepEqual(attempt.headers(), headers); // Network errors/401 retry do not reset.
  attempt.reset(); assert.notDeepEqual(attempt.headers(), headers);
});
test("guest evidence reuses the contribution submission key", () => {
  const attempt = createEvidenceAttempt(env);
  assert.deepEqual(attempt.headers("synthetic-guest-key"), { "Idempotency-Key": "synthetic-guest-key" });
  assert.deepEqual(attempt.headers(), { "Idempotency-Key": "synthetic-guest-key" });
});
test("in-progress response cannot reset a keyed form or report success", () => {
  assert.throws(() => assertEvidenceComplete({ ok: true, status: 202 }, {}, { "Idempotency-Key": "synthetic-key" }), /pending/);
  assert.throws(() => assertEvidenceComplete({ ok: true, status: 200 }, { success: false }, { "Idempotency-Key": "synthetic-key" }), /pending/);
  assert.doesNotThrow(() => assertEvidenceComplete({ ok: true, status: 201 }, { success: true }, { "Idempotency-Key": "synthetic-key" }));
  assert.doesNotThrow(() => assertEvidenceComplete({ ok: true, status: 202 }, {}, {}));
});
for (const page of ["PlantingPage", "MonitoringPage", "GuestEventPage"]) test(`${page} wires stable keys and completion validation`, () => {
  const source = fs.readFileSync(new URL(`../src/pages/${page}.jsx`, import.meta.url), "utf8");
  assert.match(source, /headers: evidenceAttempt.current.headers\(/);
  assert.match(source, /assertEvidenceComplete\(response, payload, options.headers\)/);
  assert.match(source, /evidenceAttempt.current.reset\(\)/);
});
test("guest retry remains available when its own contribution consumed the last allocation", () => {
  const source = fs.readFileSync(new URL("../src/pages/GuestEventPage.jsx", import.meta.url), "utf8");
  assert.match(source, /!recovering && quantity > Number\(latestAllocation.remaining\)/);
  assert.match(source, /!evidenceRecovery && \(selectedAllocation.remaining <= 0 \|\| allRecorded\)/);
  assert.match(source, /if \(evidenceAttempt.current.enabled\) setEvidenceRecovery\(true\)/);
});
