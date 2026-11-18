import test from "node:test";
import assert from "node:assert/strict";
import { TRACKING_STATUS, deriveTrackingRows, isVerifiedPlantingReport, trackingMatchesRecordFilters, trackingNeedsCohortLookup } from "../src/utils/monitoringTracking.js";

const verified = (id, monitoring, extra = {}) => ({ id, reportNumber: `RPT-${id}`, siteName: `Site ${id}`, barangay: "Bical", reportingProgress: "Completed",
  verificationStatus: "Completed", acceptedQuantity: 20, ...(monitoring ? { reportingPolicy: { monitoring } } : {}), ...extra });
const cohort = (reportId, extra = {}) => ({ id: `VPC-${reportId}`, verifiedPlantedQuantity: 18, source: { plantingReportId: reportId },
  samplingPlan: { status: "DRAFT" }, baseline: { approvalStatus: "NOT_STARTED" }, ...extra });
const ready = { cohortEnabled: true, cohortState: "ready", readinessState: "ready" };

test("only Admin-verified, unarchived reports are eligible", () => {
  assert.equal(isVerifiedPlantingReport(verified("a")), true);
  assert.equal(isVerifiedPlantingReport({ id: "b", verificationStatus: "Approved" }), true);
  assert.equal(isVerifiedPlantingReport({ id: "c", verificationStatus: "Pending", reportingProgress: "Awaiting Submission" }), false);
  assert.equal(isVerifiedPlantingReport(verified("d", null, { archived: true })), false);
  assert.equal(isVerifiedPlantingReport(null), false);
});

test("each stored monitoring policy shows its truthful tracking status without conversion", () => {
  const rows = deriveTrackingRows({ ...ready, reports: [
    verified("spot", "STAFF_SPOT_CHECK"), verified("perm", "PERMANENT_SAMPLE"), verified("legacy", null), verified("none", "NONE"), verified("odd", "OTHER"),
  ], cohorts: [], readiness: { cohorts: [] } });
  assert.deepEqual(rows.map(row => [row.plantingReportId, row.policy, row.status]), [
    ["spot", "STAFF_SPOT_CHECK", TRACKING_STATUS.SPOT_CHECK],
    ["perm", "PERMANENT_SAMPLE", TRACKING_STATUS.SETUP_PENDING],
    ["legacy", "LEGACY", TRACKING_STATUS.LEGACY],
    ["odd", "UNKNOWN", TRACKING_STATUS.UNKNOWN],
  ]);
  assert.equal(rows[0].requirement, "Staff spot-check");
  assert.match(rows[0].notes.join(" "), /pending MENRO policy/);
  assert.equal(rows[0].cohort, null);
  assert.ok(rows.every(row => row.kind === "tracking"));
});

test("a permanent-sample cohort shows actual sampling, baseline and visit readiness", () => {
  const readiness = { cohorts: [{ cohortId: "VPC-perm", canCreateVisit: false, reasons: [{ code: "SAMPLING_PLAN_NOT_APPROVED", planStatus: "DRAFT" }, { code: "VISIT_SCHEDULING_POLICY_PENDING" }] }] };
  const [row] = deriveTrackingRows({ ...ready, reports: [verified("perm", "PERMANENT_SAMPLE")], cohorts: [cohort("perm")], readiness });
  assert.equal(row.status, TRACKING_STATUS.SETUP_IN_PROGRESS);
  assert.equal(row.setup, "Sampling plan: Draft · Baseline: Not Started · Visit: Not ready");
  assert.deepEqual(row.cohort, { id: "VPC-perm", samplingPlanStatus: "Draft", approvedSampleTarget: null, registeredSampleTrees: null });
  assert.equal(row.verifiedPlantedQuantity, 18, "the authoritative cohort quantity wins");
  assert.ok(row.reasons.some(reason => /scheduling policy/.test(reason)));
  const [readyRow] = deriveTrackingRows({ ...ready, reports: [verified("perm", "PERMANENT_SAMPLE")], cohorts: [cohort("perm")],
    readiness: { cohorts: [{ cohortId: "VPC-perm", canCreateVisit: true, reasons: [] }] } });
  assert.equal(readyRow.status, TRACKING_STATUS.READY);
});

test("a pending MENRO policy is tracked as pending: not exempt, not monitored, no cohort lookup", () => {
  const report = verified("pending", "PENDING_MENRO_POLICY");
  const [row] = deriveTrackingRows({ ...ready, reports: [report], cohorts: [cohort("pending")] });
  assert.equal(row.policy, "PENDING_MENRO_POLICY");
  assert.equal(row.status, TRACKING_STATUS.POLICY_PENDING);
  assert.equal(row.requirement, "Monitoring policy pending MENRO decision");
  assert.match(row.notes.join(" "), /neither waived nor authorized/);
  assert.equal(row.setup, "");
  assert.equal(trackingNeedsCohortLookup([report], true), false);
});

test("loading, error and feature-disabled states are explicit and never guess setup", () => {
  const reports = [verified("perm", "PERMANENT_SAMPLE"), verified("spot", "STAFF_SPOT_CHECK")];
  assert.deepEqual(deriveTrackingRows({ reports, cohortEnabled: true, cohortState: "loading", readinessState: "loading" }).map(row => row.status),
    [TRACKING_STATUS.CHECKING, TRACKING_STATUS.SPOT_CHECK]);
  assert.deepEqual(deriveTrackingRows({ reports, cohortEnabled: true, cohortState: "error", readinessState: "error" }).map(row => row.status),
    [TRACKING_STATUS.UNAVAILABLE, TRACKING_STATUS.SPOT_CHECK]);
  assert.deepEqual(deriveTrackingRows({ reports, cohortEnabled: false }).map(row => row.status),
    [TRACKING_STATUS.NOT_AVAILABLE, TRACKING_STATUS.SPOT_CHECK]);
  const [visitUnavailable] = deriveTrackingRows({ reports: [verified("perm", "PERMANENT_SAMPLE")], cohortEnabled: true, cohortState: "ready", cohorts: [cohort("perm")], readinessState: "error" });
  assert.match(visitUnavailable.setup, /Visit: Unavailable$/);
});

test("no duplicate row when an actual lifecycle or listed visit exists, and each report appears once", () => {
  const reports = [verified("a", "STAFF_SPOT_CHECK"), verified("a", "STAFF_SPOT_CHECK"), verified("b", "STAFF_SPOT_CHECK"), verified("c", "PERMANENT_SAMPLE")];
  const rows = deriveTrackingRows({ ...ready, reports, lifecycles: [{ plantingReportId: "b", archived: true }], cohorts: [cohort("c")],
    readiness: { cohorts: [] }, visitCohortIds: new Set(["VPC-c"]) });
  assert.deepEqual(rows.map(row => row.plantingReportId), ["a"]);
});

test("tracking rows carry no observation, condition or monitoring date and are excluded by those filters", () => {
  const [row] = deriveTrackingRows({ ...ready, reports: [verified("spot", "STAFF_SPOT_CHECK")] });
  for (const key of ["condition", "species", "monitoredDate", "history", "observations", "survivalRate"]) assert.equal(key in row, false, key);
  assert.equal(trackingMatchesRecordFilters(row), true);
  assert.equal(trackingMatchesRecordFilters(row, { search: "rpt-spot" }), true);
  assert.equal(trackingMatchesRecordFilters(row, { search: "spot-check" }), true);
  assert.equal(trackingMatchesRecordFilters(row, { search: "nothing" }), false);
  assert.equal(trackingMatchesRecordFilters(row, { site: "Site spot" }), true);
  assert.equal(trackingMatchesRecordFilters(row, { site: "Other" }), false);
  assert.equal(trackingMatchesRecordFilters(row, { species: "Narra" }), false);
  assert.equal(trackingMatchesRecordFilters(row, { condition: "Healthy" }), false);
  assert.equal(trackingMatchesRecordFilters(row, { from: "2026-01-01" }), false);
});

test("cohort lookups run only for permanent-sample or legacy verified reports with the feature enabled", () => {
  assert.equal(trackingNeedsCohortLookup([verified("s", "STAFF_SPOT_CHECK")], true), false);
  assert.equal(trackingNeedsCohortLookup([verified("p", "PERMANENT_SAMPLE")], true), true);
  assert.equal(trackingNeedsCohortLookup([verified("l", null)], true), true);
  assert.equal(trackingNeedsCohortLookup([verified("p", "PERMANENT_SAMPLE")], false), false);
  assert.equal(trackingNeedsCohortLookup([{ id: "x", reportingPolicy: { monitoring: "PERMANENT_SAMPLE" }, reportingProgress: "Awaiting Submission" }], true), false);
  assert.equal(trackingNeedsCohortLookup([verified("l", null)], true, [{ plantingReportId: "l" }]), false, "a report with a lifecycle needs no lookup");
});
