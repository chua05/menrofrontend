import test from "node:test";
import assert from "node:assert/strict";
import { describeMonitoringStatus, monitoringPolicyOf, needsCohortLookup } from "../src/utils/monitoringStatus.js";

const report = (monitoring) => ({ id: "report-1", ...(monitoring === undefined ? {} : { reportingPolicy: { monitoring } }) });
const cohort = { id: "VPC-fixture", source: { plantingReportId: "report-1" }, samplingPlan: { status: "DRAFT" }, baselineStatus: "NOT_STARTED" };
const pendingReadiness = { cohorts: [{ cohortId: "VPC-fixture", canCreateVisit: false, reasons: [
  { code: "SAMPLING_POLICY_PENDING", pending: ["MINIMUM_SAMPLE_POLICY_PENDING", "FIRST_VISIT_DELAY_PENDING"] },
  { code: "SAMPLING_PLAN_NOT_APPROVED", planStatus: "DRAFT" },
  { code: "BASELINE_NOT_APPROVED", baselineStatus: "NOT_STARTED" },
  { code: "VISIT_SCHEDULING_POLICY_PENDING" },
] }] };
const ready = (overrides = {}) => ({ cohortEnabled: true, cohortState: "ready", cohorts: [cohort], readinessState: "ready", readiness: pendingReadiness, ...overrides });

test("policy type comes only from the stored reportingPolicy", () => {
  assert.equal(monitoringPolicyOf(report()), "LEGACY");
  assert.equal(monitoringPolicyOf(report("STAFF_SPOT_CHECK")), "STAFF_SPOT_CHECK");
  assert.equal(monitoringPolicyOf(report("PERMANENT_SAMPLE")), "PERMANENT_SAMPLE");
  assert.equal(monitoringPolicyOf(report("NONE")), "NONE");
  assert.equal(monitoringPolicyOf(report("SOMETHING_ELSE")), "UNKNOWN");
});

test("nested policy definitions and compatible flat snapshots keep the stored method", () => {
  for (const method of ["NONE", "STAFF_SPOT_CHECK", "PERMANENT_SAMPLE", "PENDING_MENRO_POLICY"]) {
    const nested = { id: "report-1", reportingPolicy: { definition: { monitoring: method } } };
    const matching = { id: "report-1", reportingPolicy: { monitoring: method, definition: { monitoring: method } } };
    assert.equal(monitoringPolicyOf(nested), method);
    assert.equal(monitoringPolicyOf(matching), method);
    assert.equal(needsCohortLookup(nested, true), method === "PERMANENT_SAMPLE");
    assert.equal(monitoringPolicyOf({ reportingPolicy: { monitoring: "", definition: { monitoring: method } } }), method);
  }
  assert.equal(monitoringPolicyOf({ reportingPolicy: { definition: {} } }), "UNKNOWN");
  assert.equal(monitoringPolicyOf({ reportingPolicy: { definition: { monitoring: "OTHER" } } }), "UNKNOWN");
});

test("conflicting policy snapshots stay unknown without mutating them or looking up a cohort", () => {
  for (const [flat, nested] of [["NONE", "STAFF_SPOT_CHECK"], ["STAFF_SPOT_CHECK", "PERMANENT_SAMPLE"], ["PERMANENT_SAMPLE", "NONE"]]) {
    const stored = { id: "report-1", reportingPolicy: { monitoring: flat, definition: { monitoring: nested } } };
    const original = JSON.stringify(stored);
    assert.equal(monitoringPolicyOf(stored), "UNKNOWN");
    assert.equal(needsCohortLookup(stored, true), false);
    const status = describeMonitoringStatus({ report: stored, ...ready() });
    assert.equal(status.requirement, "Unrecognized Monitoring Method");
    assert.deepEqual(status.rows, []);
    assert.match(status.notes.join(" "), /not recognized/);
    assert.equal(JSON.stringify(stored), original);
  }
});

test("Staff spot-check reports say the workflow is pending MENRO policy and never look up or show a cohort", () => {
  assert.equal(needsCohortLookup(report("STAFF_SPOT_CHECK"), true), false);
  // Even if a cohort list were supplied, a spot-check report shows none.
  const status = describeMonitoringStatus({ report: report("STAFF_SPOT_CHECK"), ...ready() });
  assert.equal(status.requirement, "Staff Spot-Check");
  assert.match(status.notes.join(" "), /Monitoring workflow pending MENRO policy/);
  assert.deepEqual(status.rows, []);
  assert.deepEqual(status.reasons, []);
  assert.doesNotMatch(JSON.stringify(status), /VPC-/);
});

test("permanent-sample reports show the existing cohort with actual plan, baseline and readiness", () => {
  const status = describeMonitoringStatus({ report: report("PERMANENT_SAMPLE"), ...ready() });
  assert.deepEqual(status.rows, [
    { label: "Cohort", value: "VPC-fixture" },
    { label: "Sampling plan", value: "Draft" },
    { label: "Baseline", value: "Not Started" },
    { label: "Visit readiness", value: "Not ready for a monitoring visit." },
  ]);
  assert.deepEqual(status.reasons, [
    "The MENRO sampling policy is incomplete: minimum sample size, first visit timing.",
    "The sampling plan is not approved yet (current status: Draft).",
    "The permanent sample baseline is not approved yet (current status: Not Started).",
    "New monitoring visits can start only after MENRO approves the visit scheduling policy.",
  ]);
});

test("a missing cohort is reported as missing; no cohort ID is computed or invented", () => {
  const status = describeMonitoringStatus({ report: report("PERMANENT_SAMPLE"), ...ready({ cohorts: [{ ...cohort, source: { plantingReportId: "other" } }] }) });
  assert.deepEqual(status.rows, []);
  assert.match(status.notes.join(" "), /No permanent-sample cohort exists for this report/);
  assert.doesNotMatch(JSON.stringify(status), /VPC-/);
});

test("readiness is never assumed when it is missing, loading or failed", () => {
  for (const [overrides, text] of [
    [{ readinessState: "loading", readiness: null }, "Checking visit readiness…"],
    [{ readinessState: "error", readiness: null }, "Visit readiness is unavailable."],
    [{ readiness: { cohorts: [] } }, "Visit readiness is unavailable."],
  ]) {
    const status = describeMonitoringStatus({ report: report("PERMANENT_SAMPLE"), ...ready(overrides) });
    assert.equal(status.rows.at(-1).value, text);
    assert.deepEqual(status.reasons, []);
  }
  const allowed = describeMonitoringStatus({ report: report("PERMANENT_SAMPLE"), ...ready({ readiness: { cohorts: [{ cohortId: "VPC-fixture", canCreateVisit: true, reasons: [] }] } }) });
  assert.equal(allowed.rows.at(-1).value, "Ready for a monitoring visit.");
});

test("cohort lookup states and the disabled gate are explicit", () => {
  assert.equal(needsCohortLookup(report("PERMANENT_SAMPLE"), false), false);
  assert.match(describeMonitoringStatus({ report: report("PERMANENT_SAMPLE"), cohortEnabled: false }).notes.join(" "), /not available in this environment/);
  assert.match(describeMonitoringStatus({ report: report("PERMANENT_SAMPLE"), ...ready({ cohortState: "loading" }) }).notes.join(" "), /Checking permanent-sample status/);
  assert.match(describeMonitoringStatus({ report: report("PERMANENT_SAMPLE"), ...ready({ cohortState: "error" }) }).notes.join(" "), /could not be loaded/);
});

test("legacy reports keep the historical aggregate workflow and show a cohort only if one exists", () => {
  assert.equal(needsCohortLookup(report(), true), true);
  const none = describeMonitoringStatus({ report: report(), ...ready({ cohorts: [] }) });
  assert.match(none.notes.join(" "), /historical aggregate monitoring workflow/);
  assert.deepEqual(none.rows, []);
  assert.doesNotMatch(none.notes.join(" "), /No permanent-sample cohort/);
  const withCohort = describeMonitoringStatus({ report: report(), ...ready() });
  assert.equal(withCohort.rows[0].value, "VPC-fixture");
});

test("no-monitoring and unrecognized policies have no cohort rows", () => {
  assert.match(describeMonitoringStatus({ report: report("NONE"), ...ready() }).notes.join(" "), /does not require monitoring/);
  assert.match(describeMonitoringStatus({ report: report("SOMETHING_ELSE"), ...ready() }).notes.join(" "), /not recognized/);
  assert.deepEqual(describeMonitoringStatus({ report: report("NONE"), ...ready() }).rows, []);
});
