import test from "node:test";
import assert from "node:assert/strict";
import { continueMonitoringChoices, hasMoreChoices, loadMonitoringChoices, verifiedReportStartPath, verifiedReportsPath } from "../src/utils/sampleReadinessLoader.js";
import { blockedReportRow, staffGateNotices, staffReadinessMessages, staffStartError } from "../src/utils/sampleVisitReadiness.js";

const page = (cohorts, extra = {}) => ({ cohorts, eligible: cohorts.filter(row => row.canCreateVisit), notEligible: cohorts.filter(row => !row.canCreateVisit), truncated: Boolean(extra.nextCursor), nextCursor: null, ...extra });
const row = (cohortId, canCreateVisit = true, extra = {}) => ({ cohortId, canCreateVisit, reasons: [], ...extra });

test("verified reports without a cohort are offered beside readiness rows, once each", async () => {
  const data = await loadMonitoringChoices(async () => page([row("A"), row("B", false)], { gates: { writesPaused: false } }),
    async () => page([row("B", true, { startsFromReport: true }), row("C", true, { startsFromReport: true })], { gates: { verifiedReportRuleEnabled: true } }));
  assert.deepEqual(data.cohorts.map(item => item.cohortId), ["A", "B", "C"]);
  assert.deepEqual(data.eligible.map(item => item.cohortId), ["A", "C"], "a report that already has a cohort keeps that cohort's own answer");
  assert.deepEqual(data.gates, { writesPaused: false, verifiedReportRuleEnabled: true });
  assert.equal(data.truncated, false);
});
test("a backend without the report list still works; any other list failure is reported as partial", async () => {
  const fail = status => async () => { throw Object.assign(new Error("x"), { status }); };
  const old = await loadMonitoringChoices(async () => page([row("A")]), fail(404));
  assert.equal(old.eligible.length, 1); assert.notEqual(old.partial, true);
  const partial = await loadMonitoringChoices(async () => page([row("A")]), fail(500));
  assert.equal(partial.partial, true); assert.equal(partial.truncated, true); assert.equal(hasMoreChoices(partial), true);
  await assert.rejects(loadMonitoringChoices(fail(409), async () => page([])), error => error.status === 409);
});
test("load more continues both lists until each ends", async () => {
  const readiness = async cursor => (cursor ? page([row("A2")]) : page([row("A1")], { nextCursor: "a" }));
  const reports = async cursor => (cursor ? page([row("R2")]) : page([row("R1")], { nextCursor: "r" }));
  let data = await loadMonitoringChoices(readiness, reports, { maxPages: 1 });
  assert.deepEqual([data.nextCursor, data.reportsCursor, data.truncated], ["a", "r", true]);
  data = await continueMonitoringChoices(data, readiness, reports); data = await continueMonitoringChoices(data, readiness, reports);
  assert.deepEqual(data.cohorts.map(item => item.cohortId).sort(), ["A1", "A2", "R1", "R2"]);
  assert.deepEqual([data.nextCursor, data.reportsCursor, data.truncated], [null, null, false]);
});
test("I3: continuing one list never hides that the other failed, and a failed report list is retried from its start", async () => {
  let reportsWork = false;
  const readiness = async cursor => (cursor ? page([row("A2")]) : page([row("A1")], { nextCursor: "a" }));
  const reports = async () => { if (!reportsWork) throw Object.assign(new Error("x"), { status: 500 }); return page([row("R1")]); };
  let data = await loadMonitoringChoices(readiness, reports, { maxPages: 1 });
  data = await continueMonitoringChoices(data, readiness, reports);
  assert.deepEqual([data.partial, data.truncated, data.reportsFailed, hasMoreChoices(data)], [true, true, true, true]);
  await assert.rejects(continueMonitoringChoices(data, readiness, reports));
  reportsWork = true; data = await continueMonitoringChoices(data, readiness, reports);
  assert.deepEqual([data.partial, data.truncated, hasMoreChoices(data)], [false, false, false]);
  assert.deepEqual(data.eligible.map(item => item.cohortId), ["A1", "A2", "R1"]);
});
test("a malformed readiness cursor stays reported after the report list continues", async () => {
  const readiness = async () => page([row("A1")], { nextCursor: "bad/cursor" });
  const reports = async cursor => (cursor ? page([row("R2")]) : page([row("R1")], { nextCursor: "event_EVT-1.a" }));
  let data = await loadMonitoringChoices(readiness, reports, { maxPages: 1 });
  data = await continueMonitoringChoices(data, readiness, reports);
  assert.equal(data.partial, true); assert.equal(data.truncated, true); assert.equal(hasMoreChoices(data), false); assert.equal(data.eligible.length, 3);
});
test("I7: a report already in the earlier workflow points Staff to it instead of saying nothing can be done", () => {
  for (const reasons of [[{ code: "SAMPLING_PLAN_NOT_APPROVED", planStatus: "RETURNED" }, { code: "BASELINE_NOT_APPROVED", baselineStatus: "NOT_STARTED" }], [{ code: "BASELINE_NOT_APPROVED", baselineStatus: "NOT_STARTED" }],
    [{ code: "SAMPLING_PLAN_NOT_APPROVED", planStatus: "DRAFT" }, { code: "VISIT_SCHEDULING_POLICY_PENDING" }]]) assert.deepEqual(staffReadinessMessages(reasons), ["The earlier setup of this report is still in progress. Continue it from the report in Planting Reports."]);
});
test("a refused start uses the list's words and keeps other messages", () => {
  assert.equal(staffStartError({ code: "PERMANENT_SAMPLE_WRITES_PAUSED", message: "Permanent-sample changes are paused." }), "Monitoring is paused by MENRO.");
  for (const code of ["VERIFIED_REPORT_FIRST_VISIT_DISABLED", "VISIT_SCHEDULING_POLICY_PENDING"]) assert.match(staffStartError({ code, message: "raw" }), /not open yet/);
  assert.doesNotMatch(staffStartError({ code: "REPORT_NOT_ELIGIBLE", message: "not eligible for permanent-sample monitoring" }), /permanent-sample/);
  assert.equal(staffStartError({ code: "OPEN_VISIT_EXISTS", message: "Another visit is open." }), "Another visit is open."); assert.ok(staffStartError({}).length > 0);
});
test("paths encode the report ID and cursor", () => {
  assert.equal(verifiedReportsPath(), "/verified-sample-monitoring/verified-reports");
  assert.equal(verifiedReportsPath("a b"), "/verified-sample-monitoring/verified-reports?cursor=a%20b");
  assert.equal(verifiedReportStartPath("event_EVT-1"), "/verified-sample-monitoring/verified-reports/event_EVT-1/first-visit");
});
test("Staff messages never mention policies, sampling plans, baseline approval or feature flags", () => {
  const legacy = ["SAMPLING_POLICY_SNAPSHOT_MISSING", "SAMPLING_POLICY_PENDING", "SAMPLING_PLAN_NOT_APPROVED", "TEST_ONLY_SAMPLING_POLICY", "BASELINE_NOT_APPROVED", "FIRST_VISIT_POLICY_DISABLED", "VISIT_SCHEDULING_POLICY_PENDING"].map(code => ({ code, pending: ["MINIMUM_SAMPLE_POLICY_PENDING"] }));
  assert.deepEqual(staffReadinessMessages(legacy), ["Monitoring for this report is not open yet. Contact the MENRO Admin if it should be monitored now."]);
  assert.deepEqual(staffReadinessMessages([{ code: "REPORT_NOT_ELIGIBLE", problems: ["NOT_PERMANENT_SAMPLE_MONITORING"] }]), ["Monitoring for this report is not open yet. Contact the MENRO Admin if it should be monitored now."]);
  assert.deepEqual(staffReadinessMessages([{ code: "REPORT_NOT_ELIGIBLE", problems: ["SITE_UNAVAILABLE", "REPORT_ARCHIVED"] }]), ["The planting site is missing or inactive.", "This planting report is archived."]);
  assert.match(staffReadinessMessages([{ code: "SPECIES_ALLOCATION_PENDING" }])[0], /more than one species/);
  assert.match(staffReadinessMessages([{ code: "VISIT_NOT_OPEN", openingDate: "2026-12-25" }])[0], /2026-12-25/);
  for (const text of [...staffGateNotices({ writesPaused: true, firstVisitBaselineEnabled: false, scheduleEnabled: false }), ...staffReadinessMessages(legacy)]) assert.doesNotMatch(text, /policy|baseline|sampling plan|flag|turned off|enabled/i);
});
test("one notice covers a paused or not yet opened workflow", () => {
  assert.equal(staffGateNotices({ writesPaused: true, firstVisitBaselineEnabled: false, scheduleEnabled: false }, { startable: true }).length, 1);
  assert.deepEqual(staffGateNotices({ firstVisitBaselineEnabled: false, scheduleEnabled: true }, { startable: true }), [], "never \"not open\" beside a startable visit");
  assert.deepEqual(staffGateNotices({ writesPaused: false, firstVisitBaselineEnabled: false, scheduleEnabled: false }), ["New monitoring visits are not open yet. Verified planting reports stay listed here."]);
  for (const gates of [undefined, {}, { writesPaused: "true" }, { writesPaused: false, firstVisitBaselineEnabled: true, scheduleEnabled: true }]) assert.deepEqual(staffGateNotices(gates), []);
});
test("the backend's own answer for a blocked report is found by report or cohort", () => {
  const data = { cohorts: [row("A", false, { context: { plantingReportId: "r1" } }), row("B", false)] };
  assert.equal(blockedReportRow(data, { plantingReportId: "r1" }).cohortId, "A");
  assert.equal(blockedReportRow(data, { plantingReportId: "x", cohort: { id: "B" } }).cohortId, "B");
  assert.equal(blockedReportRow(data, { plantingReportId: "x" }), null); assert.equal(blockedReportRow(null, null), null);
});
