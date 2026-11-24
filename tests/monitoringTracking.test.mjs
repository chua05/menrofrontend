import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRACKING_STATUS, deriveTrackingRows, isVerifiedPlantingReport, trackingMatchesRecordFilters, trackingNeedsCohortLookup, trackingReportNumber } from "../src/utils/monitoringTracking.js";

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
  assert.equal(rows[0].requirement, "Staff Spot-Check");
  assert.match(rows[0].notes.join(" "), /pending MENRO policy/);
  assert.equal(rows[0].cohort, null);
  assert.ok(rows.every(row => row.kind === "tracking"));
});

test("nested spot-check and pending policies stay awaiting setup; conflicts never authorize monitoring", () => {
  const nested = (id, method) => verified(id, null, { reportingPolicy: { definition: { monitoring: method } } });
  const conflict = verified("conflict", "NONE", { reportingPolicy: { monitoring: "NONE", definition: { monitoring: "PERMANENT_SAMPLE" } } });
  const reports = [nested("spot", "STAFF_SPOT_CHECK"), nested("pending", "PENDING_MENRO_POLICY"), nested("none", "NONE"), conflict];
  const original = JSON.stringify(reports);
  const rows = deriveTrackingRows({ ...ready, reports });
  assert.deepEqual(rows.map(row => [row.plantingReportId, row.policy, row.status]), [
    ["spot", "STAFF_SPOT_CHECK", TRACKING_STATUS.SPOT_CHECK],
    ["pending", "PENDING_MENRO_POLICY", TRACKING_STATUS.POLICY_PENDING],
    ["conflict", "UNKNOWN", TRACKING_STATUS.UNKNOWN],
  ]);
  assert.ok(rows.every(row => row.startMonitoringDate === "" && row.cohort === null));
  assert.match(rows[0].notes.join(" "), /have not been approved/);
  assert.equal(trackingNeedsCohortLookup(reports, true), false);
  assert.equal(JSON.stringify(reports), original);
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
  assert.equal(row.requirement, "Pending MENRO Policy Decision");
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

test("headline stages and schedule labels come only from stored policy and existing rules", async () => {
  const { TRACKING_STAGE, SCHEDULE_LABEL } = await import("../src/utils/monitoringTracking.js");
  const rows = deriveTrackingRows({ ...ready, today: "2026-11-18", cohorts: [], readiness: { cohorts: [] }, reports: [
    verified("spot", "STAFF_SPOT_CHECK", { plantingDate: "2026-10-01" }),
    verified("pending", "PENDING_MENRO_POLICY", { plantingDate: "2026-10-01" }),
    verified("perm", "PERMANENT_SAMPLE", { plantingDate: "2026-10-01" }),
    verified("legacy-open", null, { plantingDate: "2026-10-01" }),
    verified("legacy-soon", null, { plantingDate: "2026-11-10" }),
    verified("legacy-nodate", null),
  ] });
  const by = Object.fromEntries(rows.map(row => [row.plantingReportId, row]));
  for (const id of ["spot", "pending", "perm"]) {
    assert.equal(by[id].stage, TRACKING_STAGE.AWAITING_SETUP, id);
    assert.equal(by[id].startMonitoringDate, "", `${id}: no invented start date`);
    assert.equal(by[id].startLabel, SCHEDULE_LABEL.POLICY);
    assert.equal(by[id].nextLabel, SCHEDULE_LABEL.NOT_SCHEDULED);
  }
  assert.equal(by.spot.status, TRACKING_STATUS.SPOT_CHECK, "the specific reason stays visible");
  // Legacy aggregate lifecycles open 14 days after planting (existing backend rule); Staff can submit from then.
  assert.deepEqual([by["legacy-open"].startMonitoringDate, by["legacy-open"].stage], ["2026-10-15", TRACKING_STAGE.AWAITING_SUBMISSION]);
  assert.deepEqual([by["legacy-soon"].startMonitoringDate, by["legacy-soon"].stage], ["2026-11-24", TRACKING_STAGE.NOT_YET_AVAILABLE]);
  assert.deepEqual([by["legacy-nodate"].startMonitoringDate, by["legacy-nodate"].stage, by["legacy-nodate"].startLabel], ["", TRACKING_STAGE.AWAITING_SETUP, "Planting date not recorded"]);
  // A permanent-sample first visit date is shown only when the backend computed it from a complete policy.
  const withDue = deriveTrackingRows({ ...ready, today: "2026-11-18", reports: [verified("perm", "PERMANENT_SAMPLE")], readiness: { cohorts: [] },
    cohorts: [cohort("perm", { samplingReadiness: { pending: [], firstVisitDueDate: "2026-12-01" } })] });
  assert.equal(withDue[0].startMonitoringDate, "2026-12-01");
  const pendingDue = deriveTrackingRows({ ...ready, today: "2026-11-18", reports: [verified("perm", "PERMANENT_SAMPLE")], readiness: { cohorts: [] },
    cohorts: [cohort("perm", { samplingReadiness: { pending: ["FIRST_VISIT_DELAY_PENDING"], firstVisitDueDate: "2026-12-01" } })] });
  assert.equal(pendingDue[0].startMonitoringDate, "");
});

test("site and barangay labels fall back to the registered planting site, never a guess", () => {
  const [row] = deriveTrackingRows({ ...ready, reports: [verified("s", "STAFF_SPOT_CHECK", { siteName: "", barangay: "", siteId: "site-9" })],
    sites: [{ id: "site-9", siteName: "Bical Reforestation Site", barangay: "Bical" }] });
  assert.deepEqual([row.siteName, row.barangay], ["Bical Reforestation Site", "Bical"]);
  const [unknown] = deriveTrackingRows({ ...ready, reports: [verified("u", "STAFF_SPOT_CHECK", { siteName: "", barangay: "", siteId: "missing" })], sites: [] });
  assert.deepEqual([unknown.siteName, unknown.barangay], ["", ""]);
});

test("a tracking row shows one authoritative report number in its cell, action label and details", () => {
  // A stored non-canonical number (e.g. PR-FV-…) used to be hashed into RPT-xxxxxxx in the cell while the
  // action label used the stored number. The stored number is shown everywhere now.
  assert.equal(trackingReportNumber({ reportNumber: "PR-FV-e37a511f", plantingReportId: "report-1" }), "PR-FV-e37a511f");
  assert.equal(trackingReportNumber({ reportNumber: "RPT-2026-101", plantingReportId: "report-1" }), "RPT-2026-101");
  assert.match(trackingReportNumber({ reportNumber: "", plantingReportId: "report-1" }), /^RPT-[A-Z0-9]{7}$/);
  const page = readFileSync(new URL("../src/pages/MonitoringPage.jsx", import.meta.url), "utf8");
  assert.match(page, /<td>\{trackingReportNumber\(row\)\}<\/td>/);
  assert.match(page, /View monitoring record details for \$\{trackingReportNumber\(row\)\}/);
  assert.doesNotMatch(page, /formatDisplayId\("RPT", row\.reportNumber, row\.plantingReportId\)/);
  const details = readFileSync(new URL("../src/components/MonitoringTrackingDetails.jsx", import.meta.url), "utf8");
  assert.match(details, /value=\{trackingReportNumber\(row\)\}/);
});
