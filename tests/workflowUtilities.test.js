import test from "node:test";
import assert from "node:assert/strict";
import { markSuccessfulLogin, consumeSuccessfulLogin } from "../src/utils/loginSuccess.js";
import { metricAvailability } from "../src/utils/dashboardAvailability.js";
import { identificationFormatError } from "../src/utils/identificationFormat.js";
import { backendFieldErrors } from "../src/utils/formValidation.js";
test("successful-login marker is consumed once for the authenticated dashboard user", () => {
  const old = globalThis.window, data = new Map();
  globalThis.window = { sessionStorage: { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } };
  try {
    markSuccessfulLogin({ uid: "fixture-user" }); assert.ok(consumeSuccessfulLogin({ uid: "fixture-user" })); assert.equal(consumeSuccessfulLogin({ uid: "fixture-user" }), null);
    markSuccessfulLogin({ uid: "old-user" }); assert.equal(consumeSuccessfulLogin({ uid: "different-user" }), null); assert.equal(consumeSuccessfulLogin({ uid: "old-user" }), null);
  } finally { globalThis.window = old; }
});
test("unavailable metrics never become zero and fulfilled unrelated/actual-zero metrics are preserved", () => {
  const requests = { id: "my-requests", value: 2 }, reports = { id: "my-reports", value: 0 };
  assert.equal(metricAvailability(requests, new Set(["reports"])), requests);
  assert.equal(metricAvailability(reports, new Set()).value, 0);
  assert.equal(metricAvailability(reports, new Set(["reports"])).value, "Unavailable");
  assert.equal(reports.value, 0);
});
test("known printed identifier formats reject confidential PSN and invalid PhilHealth/TIN input", () => {
  assert.equal(identificationFormatError("national_id", "1234-5678-9012-3456"), ""); assert.match(identificationFormatError("national_id", "123456789012"), /PCN.*PSN/);
  assert.ok(identificationFormatError("philhealth", "ABC123")); assert.ok(identificationFormatError("tin", "12345678"));
});
test("backend field aliases preserve field messages and reject nonstring summaries", () => {
  assert.deepEqual(backendFieldErrors({ fieldErrors: { proposedDate: "Choose a future date", quantityPlanted: "Enter a whole number", internal: {} } }, { proposedDate: "activityDate", quantityPlanted: "quantity" }), { activityDate: "Choose a future date", quantity: "Enter a whole number" });
});
