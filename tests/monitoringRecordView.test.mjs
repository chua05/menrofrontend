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

test("awaiting-setup status is displayed as Awaiting First Monitoring Visit without changing the stored status", async () => {
  const { AWAITING_SUBMISSION_LABEL, isAwaitingMonitoringSetup, monitoringStatusLabel, monitoringStatusTone } = await import("../src/utils/monitoringRecordView.js");
  const record = Object.freeze({ scheduleStatus: "AWAITING_MONITORING_POLICY", status: "Awaiting Monitoring Setup", monitoringMethod: "STAFF_SPOT_CHECK" });
  assert.equal(AWAITING_SUBMISSION_LABEL, "Awaiting First Monitoring Visit");
  assert.equal(monitoringStatusLabel(record.status), "Awaiting First Monitoring Visit");
  // The stored value and the submission gate are untouched by the display label.
  assert.equal(record.status, "Awaiting Monitoring Setup");
  assert.equal(isAwaitingMonitoringSetup(record), true);
  assert.equal(isAwaitingMonitoringSetup({ status: "Awaiting First Monitoring Visit" }), false, "the display label never stands in for the stored status");
  // Other statuses pass through unchanged.
  for (const status of ["Available for Monitoring", "Not Yet Available", "Next Monitoring Scheduled", "Monitoring Completed"]) assert.equal(monitoringStatusLabel(status), status);
  assert.equal(monitoringStatusLabel(undefined), "");
  assert.deepEqual(["Awaiting First Monitoring Visit", "Available for Monitoring", "Monitoring Completed", "Monitoring Requirement Not Recognized"].map(monitoringStatusTone),
    ["pending", "active", "complete", "default"]);
});

test("an existing lifecycle shows no start date or schedule before Visit 1, then follows its permanent-sample visits", async () => {
  const { lifecycleMonitoringView: view } = await import("../src/utils/monitoringRecordView.js");
  const record = Object.freeze({ monitoringNumber: "MON-2026-001", scheduleStatus: "AWAITING_MONITORING_POLICY", status: "Awaiting Monitoring Setup" });
  const base = { cohortId: "c", approvedVisits: 0, startMonitoringDate: null, startProvisional: false, nextVisitNumber: 1, nextMonitoringDate: null, nextStatus: null, openVisit: null, latest: null };
  const pick = sample => { const v = view({ ...record, permanentSample: sample }); return [v.start, v.startNote, v.next, v.status, v.action]; };
  const none = ["", "", "", "Awaiting First Monitoring Visit", "Start Visit 1"];
  assert.deepEqual(pick(undefined), none); assert.deepEqual(pick(null), none); assert.deepEqual(pick(base), none);
  assert.deepEqual(pick({ ...base, openVisit: { visitNumber: 1, status: "DRAFT", ownedByYou: true } }), ["", "", "", "Visit 1: Draft", "Continue Visit 1"]);
  assert.deepEqual(pick({ ...base, startMonitoringDate: "2026-11-10", startProvisional: true, openVisit: { visitNumber: 1, status: "PENDING_ADMIN_APPROVAL", ownedByYou: true } }), ["2026-11-10", "Pending Admin Review", "", "Visit 1: Pending Admin Review", "View Visit 1"]);
  assert.deepEqual(pick({ ...base, openVisit: { visitNumber: 1, status: "RETURNED", ownedByYou: false } }), ["", "", "", "Visit 1: Returned for Correction", ""]);
  assert.deepEqual(pick({ ...base, approvedVisits: 1, nextVisitNumber: 2, startMonitoringDate: "2026-11-10", nextMonitoringDate: "2026-12-10", nextStatus: "SCHEDULED" }), ["2026-11-10", "", "2026-12-10", "Next Monitoring Scheduled", "Monitor Planted Trees"]);
  assert.equal(pick({ ...base, approvedVisits: 1, nextVisitNumber: 2, nextMonitoringDate: "2026-12-10", nextStatus: "DUE" })[4], "Start Visit 2");
  const condition = latest => view({ ...record, permanentSample: { ...base, approvedVisits: 1, latest: { visitNumber: 1, total: 3, healthy: 0, damaged: 0, confirmedDead: 0, needsRechecking: 0, survivalRate: 100, ...latest } } }).condition;
  assert.deepEqual([condition({ healthy: 3 }), condition({ healthy: 2, damaged: 1 }), condition({ healthy: 2, confirmedDead: 1 }), condition({ confirmedDead: 3 }), condition({ healthy: 2, needsRechecking: 1 })], ["Healthy", "Damaged", "Damaged", "Dead", "Needs Rechecking"]);
  // A legacy aggregate lifecycle without sample visits keeps its own display.
  assert.equal(view({ status: "Available for Monitoring", startMonitoringDate: "2026-01-01" }), null);
  assert.equal(record.status, "Awaiting Monitoring Setup");
});
test("a switched-off server setting is named exactly and never blamed on the report", async () => {
  const { gateReasons } = await import("../src/utils/sampleVisitReadiness.js");
  assert.deepEqual(gateReasons({ writesPaused: false, verifiedReportRuleEnabled: true, firstVisitBaselineEnabled: true, scheduleEnabled: true }), []);
  const [text] = gateReasons({ verifiedReportRuleEnabled: false, scheduleEnabled: false });
  assert.match(text, /verified planting report, the monitoring visit schedule/); assert.match(text, /nothing is wrong with this report/);
  assert.deepEqual(gateReasons({ writesPaused: true }), ["Monitoring is paused by MENRO."]);
});
