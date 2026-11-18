import test from "node:test";
import assert from "node:assert/strict";
import { MONITORING_ID_NOT_ASSIGNED, hasMonitoringId, monitoringDisplayId } from "../src/utils/monitoringRecordView.js";

test("only a backend-assigned sequential MON-YYYY-NNN number is shown as the Monitoring ID", () => {
  assert.equal(monitoringDisplayId({ monitoringNumber: "MON-2026-004" }), "MON-2026-004");
  assert.equal(monitoringDisplayId({ monitoringNumber: "mon-2026-1234" }), "MON-2026-1234");
  // Document IDs (MON-<hash>), legacy IDs and missing numbers never become a display ID.
  for (const record of [{ id: "MON-0a1b2c3d4e5f60718293" }, { monitoringNumber: "MON-AB12CD3" }, { monitoringId: "MON-2026-001" }, {}, null])
    assert.equal(monitoringDisplayId(record), MONITORING_ID_NOT_ASSIGNED, JSON.stringify(record));
  assert.equal(hasMonitoringId({ monitoringNumber: "MON-2026-010" }), true);
  assert.equal(hasMonitoringId({ id: "MON-0a1b2c3d4e5f60718293" }), false);
});

test("monitoring method is separate from status, and awaiting-setup records name their specific blocker", async () => {
  const { isAwaitingMonitoringSetup, lifecycleMethodLabel, monitoringSetupBlocker } = await import("../src/utils/monitoringRecordView.js");
  const spot = { monitoringMethod: "STAFF_SPOT_CHECK", scheduleStatus: "AWAITING_MONITORING_POLICY", status: "Awaiting Monitoring Setup" };
  assert.equal(lifecycleMethodLabel(spot), "Staff Spot-Check");
  assert.equal(lifecycleMethodLabel({ monitoringMethod: "PERMANENT_SAMPLE" }), "Permanent Sample Monitoring");
  assert.equal(lifecycleMethodLabel({}), "Historical Aggregate Monitoring");
  assert.equal(lifecycleMethodLabel({ monitoringMethod: "SOMETHING_NEW" }), "Unrecognized Monitoring Method");
  assert.equal(isAwaitingMonitoringSetup(spot), true);
  // Staff Spot-Check shows no policy explanation; it stays awaiting setup (no submission) regardless.
  assert.equal(monitoringSetupBlocker(spot), "");
  assert.match(monitoringSetupBlocker({ ...spot, monitoringMethod: "PERMANENT_SAMPLE" }), /sampling plan, baseline and visit scheduling/);
  // An aggregate lifecycle with an approved schedule has no blocker and is not awaiting setup.
  const scheduled = { status: "Available for Monitoring", startMonitoringDate: "2026-10-15" };
  assert.equal(isAwaitingMonitoringSetup(scheduled), false);
  assert.equal(monitoringSetupBlocker(scheduled), "");
});

test("awaiting-setup status is displayed as Awaiting Monitoring Submission without changing the stored status", async () => {
  const { AWAITING_SUBMISSION_LABEL, isAwaitingMonitoringSetup, monitoringStatusLabel, monitoringStatusTone } = await import("../src/utils/monitoringRecordView.js");
  const record = Object.freeze({ scheduleStatus: "AWAITING_MONITORING_POLICY", status: "Awaiting Monitoring Setup", monitoringMethod: "STAFF_SPOT_CHECK" });
  assert.equal(AWAITING_SUBMISSION_LABEL, "Awaiting Monitoring Submission");
  assert.equal(monitoringStatusLabel(record.status), "Awaiting Monitoring Submission");
  // The stored value and the submission gate are untouched by the display label.
  assert.equal(record.status, "Awaiting Monitoring Setup");
  assert.equal(isAwaitingMonitoringSetup(record), true);
  assert.equal(isAwaitingMonitoringSetup({ status: "Awaiting Monitoring Submission" }), false, "the display label never stands in for the stored status");
  // Other statuses pass through unchanged.
  for (const status of ["Available for Monitoring", "Not Yet Available", "Next Monitoring Scheduled", "Monitoring Completed"]) assert.equal(monitoringStatusLabel(status), status);
  assert.equal(monitoringStatusLabel(undefined), "");
  assert.deepEqual(["Awaiting Monitoring Submission", "Available for Monitoring", "Monitoring Completed", "Monitoring Requirement Not Recognized"].map(monitoringStatusTone),
    ["pending", "active", "complete", "default"]);
});
