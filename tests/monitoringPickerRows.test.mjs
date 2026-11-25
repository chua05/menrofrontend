import test from "node:test";
import assert from "node:assert/strict";
import { PICKER_GROUP, TRACKING_STATUS, deriveTrackingRows, trackingNeedsCohortLookup, withPickerReadiness } from "../src/utils/monitoringTracking.js";
import { withoutEligibleDuplicates } from "../src/utils/sampleVisitReadiness.js";

const verified = (id, reportingPolicy, extra = {}) => ({ id, reportNumber: `RPT-${id}`, siteName: `Site ${id}`, barangay: "Bical", plantingDate: "2026-10-01",
  reportingProgress: "Completed", verificationStatus: "Completed", acceptedQuantity: 20, ...(reportingPolicy ? { reportingPolicy } : {}), ...extra });
const flat = monitoring => ({ monitoring });
const nested = monitoring => ({ definition: { monitoring } });
const cohort = (reportId, extra = {}) => ({ id: `VPC-${reportId}`, verifiedPlantedQuantity: 18, source: { plantingReportId: reportId },
  samplingPlan: { status: "DRAFT" }, baseline: { approvalStatus: "NOT_STARTED" }, ...extra });
const ready = { cohortEnabled: true, cohortState: "ready", readinessState: "idle" };
const picker = input => deriveTrackingRows({ ...ready, includeTracked: true, ...input });

test("the default projection still hides MON-tracked reports and adds no new keys", () => {
  const input = { ...ready, reports: [verified("a", flat("PERMANENT_SAMPLE")), verified("b", flat("PERMANENT_SAMPLE"), { species: "Narra" }), verified("none", flat("NONE"))], lifecycles: [{ plantingReportId: "a" }] };
  const rows = deriveTrackingRows(input);
  assert.deepEqual(rows.map(row => row.plantingReportId), ["b"]);
  for (const key of ["hasMonitoringRecord", "pickerGroup", "species", "verificationStatus", "setupSummary"]) assert.equal(key in rows[0], false, key);
  assert.deepEqual(deriveTrackingRows({ ...input, includeTracked: false }), rows);
});

test("includeTracked lists one row per verified report: tracked with a cohort, without one, and with existing visits", () => {
  const reports = [verified("cohort", flat("PERMANENT_SAMPLE")), verified("cohort", flat("PERMANENT_SAMPLE")), verified("missing", flat("PERMANENT_SAMPLE")), verified("visited", flat("PERMANENT_SAMPLE")),
    verified("untracked", flat("PERMANENT_SAMPLE")), verified("unverified", flat("PERMANENT_SAMPLE"), { reportingProgress: "Awaiting Submission", verificationStatus: "Pending" })];
  const rows = picker({ reports, lifecycles: ["cohort", "missing", "visited"].map(plantingReportId => ({ plantingReportId })),
    cohorts: [cohort("cohort"), cohort("visited")], visitCohortIds: new Set(["VPC-visited"]) });
  assert.deepEqual(rows.map(row => [row.plantingReportId, row.hasMonitoringRecord, row.pickerGroup]), [
    ["cohort", true, PICKER_GROUP.SETUP_PENDING], ["missing", true, PICKER_GROUP.SETUP_PENDING], ["visited", true, PICKER_GROUP.SETUP_PENDING], ["untracked", false, PICKER_GROUP.SETUP_PENDING]]);
  // An eligible readiness row replaces the pending row of the same cohort or the same report.
  const eligible = [{ cohortId: "VPC-visited", context: {} }, { cohortId: "VPC-other", context: { plantingReportId: "missing" } }];
  assert.deepEqual(withoutEligibleDuplicates(rows, eligible).map(row => row.plantingReportId), ["cohort", "untracked"]);
});

test("only a permanent-sample report, or a legacy report that has a cohort, is Setup Pending; every other stored policy is Not Eligible", () => {
  const cases = [
    ["nested", nested("PERMANENT_SAMPLE"), "SETUP_PENDING"], ["flat", flat("PERMANENT_SAMPLE"), "SETUP_PENDING"],
    ["both", { ...flat("PERMANENT_SAMPLE"), ...nested("PERMANENT_SAMPLE") }, "SETUP_PENDING"],
    ["padded", nested("  PERMANENT_SAMPLE "), "SETUP_PENDING"], ["blankflat", { monitoring: "  ", ...nested("PERMANENT_SAMPLE") }, "SETUP_PENDING"],
    ["conflict", { ...flat("PERMANENT_SAMPLE"), ...nested("STAFF_SPOT_CHECK") }, "NOT_ELIGIBLE"],
    ["spot", flat("STAFF_SPOT_CHECK"), "NOT_ELIGIBLE"], ["none", nested("NONE"), "NOT_ELIGIBLE"], ["undecided", flat("PENDING_MENRO_POLICY"), "NOT_ELIGIBLE"],
    ["statuspending", { policyStatus: "PENDING_MENRO_POLICY", ...nested("PERMANENT_SAMPLE") }, "NOT_ELIGIBLE"],
    ["odd", flat("SOMETHING"), "NOT_ELIGIBLE"], ["blank", flat(" "), "NOT_ELIGIBLE"], ["legacy", null, "NOT_ELIGIBLE"], ["legacycohort", null, "SETUP_PENDING"],
  ];
  const reports = cases.map(([id, policy]) => verified(id, policy));
  const before = JSON.stringify(reports);
  const rows = picker({ reports, cohorts: [cohort("legacycohort"), cohort("spot"), cohort("conflict")] });
  assert.deepEqual(rows.map(row => [row.plantingReportId, row.pickerGroup]), cases.map(([id, , group]) => [id, PICKER_GROUP[group]]));
  assert.equal(JSON.stringify(reports), before, "stored policies are never converted");
  const by = Object.fromEntries(rows.map(row => [row.plantingReportId, row]));
  assert.equal(by.none.status, TRACKING_STATUS.NO_MONITORING);
  assert.equal(by.none.requirement, "No Monitoring Required");
  assert.equal(by.spot.cohort, null, "a non-permanent method never shows sampling values");
  assert.equal(by.spot.setup, "");
  assert.equal(by.conflict.cohort, null);
});

test("a missing cohort is stated as setup MENRO must complete, without a guessed cause or a repeat approval", () => {
  const [row] = picker({ reports: [verified("missing", nested("PERMANENT_SAMPLE"))], lifecycles: [{ plantingReportId: "missing" }], cohorts: [] });
  const text = row.notes.join(" ");
  assert.equal(row.status, TRACKING_STATUS.SETUP_PENDING);
  assert.match(text, /Monitoring setup has not been created for this report yet/);
  assert.match(text, /MENRO must complete it/);
  assert.doesNotMatch(text, /verification workflow|re-?approve|re-?create|resubmit|because/i);
  assert.equal(row.stage, "", "the dropdown never repeats the table headline Awaiting Monitoring Submission");
});

test("a legacy report keeps its historical aggregate meaning and never looks startable", () => {
  const [untracked, tracked] = picker({ reports: [verified("a", null), verified("b", null)], lifecycles: [{ plantingReportId: "b" }], cohorts: [] });
  assert.equal(untracked.requirement, "Historical Aggregate Monitoring");
  assert.match(untracked.notes.join(" "), /historical aggregate monitoring workflow/);
  assert.equal(untracked.status, TRACKING_STATUS.LEGACY);
  assert.equal(tracked.status, TRACKING_STATUS.LEGACY_TRACKED, "a report with a monitoring record is not awaiting its first observation");
});

test("checking and unavailable cohort lookups are explicit and never claim the setup is missing", () => {
  for (const [cohortState, status] of [["loading", TRACKING_STATUS.CHECKING], ["error", TRACKING_STATUS.UNAVAILABLE]]) {
    const [row] = picker({ reports: [verified("a", flat("PERMANENT_SAMPLE"))], cohortState });
    assert.equal(row.status, status);
    assert.doesNotMatch(row.notes.join(" "), /has not been created/);
  }
});

test("authoritative report details are shown only when present", () => {
  const [full, bare, fromCohort] = picker({ cohorts: [cohort("c", { source: { plantingReportId: "c", species: [{ species: "Narra" }, { species: " Molave " }, { species: "" }] } })], reports: [
    verified("a", nested("PERMANENT_SAMPLE"), { species: "Narra", verificationStatus: "Approved" }),
    verified("b", nested("PERMANENT_SAMPLE"), { reportNumber: "", siteName: "", barangay: "", plantingDate: "", acceptedQuantity: null }),
    verified("c", nested("PERMANENT_SAMPLE"), { species: "Mixed" })] });
  assert.deepEqual([full.reportNumber, full.siteName, full.plantingDate, full.verifiedPlantedQuantity, full.species, full.verificationStatus], ["RPT-a", "Site a", "2026-10-01", 20, "Narra", "Approved"]);
  assert.deepEqual([bare.reportNumber, bare.siteName, bare.plantingDate, bare.verifiedPlantedQuantity, bare.species, bare.verificationStatus], ["", "", "", null, "", "Verified"]);
  assert.deepEqual([fromCohort.species, fromCohort.verifiedPlantedQuantity], ["Narra, Molave", 18]);
});

test("the Staff form lookup includes MON-tracked reports; the table lookup still does not", () => {
  const reports = [verified("a", nested("PERMANENT_SAMPLE"))], lifecycles = [{ plantingReportId: "a" }];
  assert.equal(trackingNeedsCohortLookup(reports, true, lifecycles), false);
  assert.equal(trackingNeedsCohortLookup(reports, true), true);
  assert.equal(trackingNeedsCohortLookup([verified("s", flat("STAFF_SPOT_CHECK")), verified("n", flat("NONE"))], true), false);
});

test("the form's own readiness answer describes each cohort row: checking, not loaded, unavailable, blocked, approved history", () => {
  const [row] = picker({ reports: [verified("perm", nested("PERMANENT_SAMPLE"))], cohorts: [cohort("perm")] });
  const base = "Sampling plan: Draft · Baseline: Not Started · Visit: ";
  assert.equal(withPickerReadiness(row, { loading: true }).setup, `${base}Checking`);
  assert.equal(withPickerReadiness(row, null).setup, `${base}Checking`);
  assert.equal(withPickerReadiness(row, { error: true }).setup, `${base}Unavailable`);
  assert.equal(withPickerReadiness(row, { data: { cohorts: [], truncated: false } }).setup, `${base}Unavailable`);
  const unread = withPickerReadiness(row, { data: { cohorts: [], truncated: true, nextCursor: "c" } });
  assert.equal(unread.setup, `${base}Not loaded yet`);
  assert.match(unread.reasons.join(" "), /Load more verified planting reports/);
  const blocked = withPickerReadiness(row, { data: { cohorts: [{ cohortId: "VPC-perm", canCreateVisit: false, nextVisitNumber: 1, reasons: [{ code: "OPEN_VISIT_EXISTS", visitStatus: "DRAFT", ownedByYou: true }] }] } });
  assert.equal(blocked.setup, `${base}Not ready`);
  assert.equal(blocked.status, TRACKING_STATUS.SETUP_IN_PROGRESS);
  assert.match(blocked.reasons.join(" "), /You already have an open visit/);
  const approved = withPickerReadiness(row, { data: { cohorts: [{ cohortId: "VPC-perm", canCreateVisit: false, nextVisitNumber: 2, reasons: [{ code: "VISIT_NOT_OPEN", openingDate: "2027-01-01" }] }] } });
  assert.equal(approved.status, "Visit 1 approved");
  // Rows without a cohort, and not-eligible rows, are never changed by readiness.
  const [missing, spot] = picker({ reports: [verified("m", nested("PERMANENT_SAMPLE")), verified("s", flat("STAFF_SPOT_CHECK"))], cohorts: [cohort("s")] });
  for (const item of [missing, spot]) assert.deepEqual(withPickerReadiness(item, { data: { cohorts: [{ cohortId: "VPC-s", canCreateVisit: true, reasons: [] }] } }), item);
});
