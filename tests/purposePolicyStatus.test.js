import test from "node:test";
import assert from "node:assert/strict";
import { approvedPolicyLabel, PENDING_MENRO_POLICY } from "../src/utils/purposePolicyStatus.js";

test("missing policy is not displayed as an exemption", () => {
  assert.equal(approvedPolicyLabel(null), "");
  assert.equal(approvedPolicyLabel({}), "Reporting not recorded ? Monitoring not recorded");
});
test("pending status takes precedence over template exemption labels", () => {
  assert.equal(approvedPolicyLabel({ policyStatus: PENDING_MENRO_POLICY, definition: { reporting: "NOT_REQUIRED", monitoring: "NONE" } }), "Pending MENRO policy decision");
});
test("partially populated pending snapshots remain pending", () => {
  for (const field of ["reporting", "monitoring"]) assert.equal(approvedPolicyLabel({ definition: { [field]: PENDING_MENRO_POLICY } }), "Pending MENRO policy decision");
});
test("resolved decisions and historical snapshots keep their approved meanings", () => {
  assert.equal(approvedPolicyLabel({ definition: { reporting: "REQUIRED", monitoring: "PERMANENT_SAMPLE" }, override: { reason: "Approved decision" } }), "Report required ? Permanent-sample monitoring (Admin decision)");
  assert.equal(approvedPolicyLabel({ definition: { reporting: "NOT_REQUIRED", monitoring: "STAFF_SPOT_CHECK" } }), "No report required ? Staff spot-check");
});
test("display never mutates an immutable approved snapshot", () => {
  const definition = Object.freeze({ reporting: PENDING_MENRO_POLICY, monitoring: PENDING_MENRO_POLICY });
  const snapshot = Object.freeze({ definition, policyStatus: PENDING_MENRO_POLICY });
  assert.equal(approvedPolicyLabel(snapshot), "Pending MENRO policy decision");
  assert.equal(snapshot.definition, definition);
});
