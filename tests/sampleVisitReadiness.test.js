import test from "node:test";
import assert from "node:assert/strict";
import { approvedVisitNote, readinessErrorMessage, readinessGateNotices, readinessMessages, readinessTitle, scheduleStatusLabel, withoutEligibleDuplicates } from "../src/utils/sampleVisitReadiness.js";

test("every backend readiness code becomes a plain Staff-facing sentence", () => {
  const messages = readinessMessages([
    { code: "FIRST_VISIT_REGISTERS_BASELINE", sampleTarget: 3 },
    { code: "SPECIES_ALLOCATION_PENDING" },
    { code: "WRITES_PAUSED" },
    { code: "SAMPLING_POLICY_SNAPSHOT_MISSING" },
    { code: "SAMPLING_POLICY_PENDING", pending: ["MINIMUM_SAMPLE_POLICY_PENDING", "SAMPLING_PERCENTAGE_PENDING", "VISIT_INTERVAL_POLICY_PENDING", "FIRST_VISIT_DELAY_PENDING"] },
    { code: "SAMPLING_PLAN_NOT_APPROVED", planStatus: "PENDING_ADMIN_APPROVAL" },
    { code: "TEST_ONLY_SAMPLING_POLICY" },
    { code: "BASELINE_NOT_APPROVED", baselineStatus: "REGISTERED" },
    { code: "OPEN_VISIT_EXISTS", visitStatus: "RETURNED", ownedByYou: true },
    { code: "VISIT_SCHEDULING_POLICY_PENDING" },
    { code: "VISIT_NOT_OPEN", openingDate: "2027-11-24" },
    { code: "APPROVED_VISIT_SCHEDULE_INCOMPLETE" },
  ]);
  assert.deepEqual(messages, [
    "Visit 1 will register the baseline and 3 permanent sample trees. Tree IDs remain provisional until Admin approval.",
    "Multi-species permanent-sample allocation is awaiting an approved MENRO procedure.",
    "Permanent-sample changes are currently paused by MENRO.",
    "This planting report has no MENRO-approved sampling policy.",
    "The MENRO sampling policy is incomplete: minimum sample size, sampling percentage, visit interval policy, first visit timing.",
    "The sampling plan is not approved yet (current status: Pending Admin Review).",
    "The sampling plan uses a test-only rule and must be replaced under an approved MENRO policy.",
    "The permanent sample baseline is not approved yet (current status: Registered).",
    "You already have an open visit for this site (Returned for Correction). Continue it from the visit list.",
    "New monitoring visits can start only after MENRO approves the visit scheduling policy.",
    "The next monitoring visit opens on 2027-11-24.",
    "The approved visit history does not contain enough scheduling information to open the next visit.",
  ]);
  assert.doesNotMatch(messages.join(" "), /_POLICY|_PENDING|OPEN_VISIT|undefined/);
});

test("another Staff member's open visit is described without identifying them", () => {
  assert.deepEqual(readinessMessages([{ code: "OPEN_VISIT_EXISTS", visitStatus: "PENDING_ADMIN_APPROVAL", ownedByYou: false }]),
    ["Another Staff member has an open visit for this site (Pending Admin Review)."]);
});

test("unknown codes and missing labels degrade safely", () => {
  assert.deepEqual(readinessMessages([{ code: "SOMETHING_NEW" }, null]), ["This site is not ready for permanent-sample monitoring."]);
  assert.equal(readinessTitle({ reportNumber: "PR-1", siteName: "Bical site" }), "PR-1 · Bical site");
  assert.equal(readinessTitle({}), "Planting report · Planting site");
});

test("readiness schedule statuses are readable labels, never raw backend codes", () => {
  assert.equal(scheduleStatusLabel("DUE"), "Due");
  assert.equal(scheduleStatusLabel("OVERDUE"), "Overdue");
  assert.equal(scheduleStatusLabel("SCHEDULED"), "Scheduled");
  assert.equal(scheduleStatusLabel("POLICY_PENDING"), "Pending Official Schedule");
  assert.equal(scheduleStatusLabel(undefined), "Pending");
  assert.equal(scheduleStatusLabel("SOMETHING_NEW"), "Pending");
});

test("a report whose cohort is eligible is listed once: Setup Pending duplicates are removed by cohortId", () => {
  const eligible = [{ cohortId: "cohort-1", context: { plantingReportId: "report-1" } }];
  const pending = [
    { plantingReportId: "report-1", cohort: { id: "cohort-1" } },
    { plantingReportId: "report-1b", cohort: { id: "cohort-1" } },
    { plantingReportId: "report-1" },
    { plantingReportId: "report-2", cohort: { id: "cohort-2" } },
    { plantingReportId: "report-3", cohort: null },
  ];
  assert.deepEqual(withoutEligibleDuplicates(pending, eligible).map(row => row.plantingReportId), ["report-2", "report-3"]);
  assert.deepEqual(withoutEligibleDuplicates(pending, []), pending);
});

test("REPORT_NOT_ELIGIBLE lists each problem in plain words; unknown problems stay generic", () => {
  const messages = readinessMessages([{ code: "REPORT_NOT_ELIGIBLE", problems: ["REPORT_NOT_FOUND", "REPORT_NOT_VERIFIED", "VERIFIED_QUANTITY_CHANGED",
    "NOT_PERMANENT_SAMPLE_MONITORING", "SITE_UNAVAILABLE", "SITE_MISMATCH", "POLICY_CONFLICT", "SOMETHING_NEW", "ANOTHER_NEW"] }]);
  assert.deepEqual(messages, [
    "The planting report for this monitoring setup could not be found.",
    "The planting report is not verified with an accepted planted quantity.",
    "The verified planted quantity changed after the monitoring setup was created.",
    "This planting report uses a different monitoring method, not permanent-sample monitoring.",
    "The planting site is missing or inactive.",
    "The planting report and its monitoring setup name different planting sites.",
    "This planting report has conflicting monitoring methods on record. MENRO must resolve them before monitoring can start.",
    "This planting report no longer satisfies the authoritative first-visit eligibility checks.",
  ]);
  for (const problems of [undefined, [], "POLICY_CONFLICT", [null, "toString", "__proto__"]])
    assert.deepEqual(readinessMessages([{ code: "REPORT_NOT_ELIGIBLE", problems }]), ["This planting report no longer satisfies the authoritative first-visit eligibility checks."]);
  assert.doesNotMatch(messages.join(" "), /_|re-?approve|re-?create|undefined/i);
});

test("FIRST_VISIT_POLICY_DISABLED replaces the legacy plan, baseline and policy-snapshot messages of the same cohort only", () => {
  const legacy = [{ code: "SAMPLING_POLICY_SNAPSHOT_MISSING" }, { code: "SAMPLING_PLAN_NOT_APPROVED", planStatus: "NOT_STARTED" }, { code: "BASELINE_NOT_APPROVED", baselineStatus: "NOT_STARTED" }];
  const disabled = "MENRO has not enabled first-visit baseline registration, so Visit 1 cannot be started for this report yet.";
  assert.deepEqual(readinessMessages([...legacy, { code: "FIRST_VISIT_POLICY_DISABLED" }]), [disabled]);
  // Other blockers stay visible, including a sampling policy MENRO has not finished.
  assert.deepEqual(readinessMessages([{ code: "WRITES_PAUSED" }, ...legacy, { code: "SAMPLING_POLICY_PENDING", pending: ["FIRST_VISIT_DELAY_PENDING"] }, { code: "FIRST_VISIT_POLICY_DISABLED" }, { code: "VISIT_SCHEDULING_POLICY_PENDING" }]), [
    "Permanent-sample changes are currently paused by MENRO.", "The MENRO sampling policy is incomplete: first visit timing.", disabled,
    "New monitoring visits can start only after MENRO approves the visit scheduling policy."]);
  assert.equal(readinessMessages(legacy).length, 3, "an older backend keeps the legacy messages");
});

test("global gate notices appear only for an explicit off/paused value", () => {
  const on = { writesPaused: false, firstVisitBaselineEnabled: true, scheduleEnabled: true, pilotRestricted: false };
  assert.deepEqual(readinessGateNotices(on), []);
  for (const gates of [undefined, null, {}, { writesPaused: "true", firstVisitBaselineEnabled: null }]) assert.deepEqual(readinessGateNotices(gates), []);
  assert.deepEqual(readinessGateNotices({ ...on, writesPaused: true }), ["MENRO has paused permanent-sample monitoring changes. Nothing can be started, saved or submitted until it resumes."]);
  assert.deepEqual(readinessGateNotices({ ...on, firstVisitBaselineEnabled: false }), ["First-visit baseline registration is turned off. Reports without an approved baseline cannot start Visit 1."]);
  assert.deepEqual(readinessGateNotices({ ...on, scheduleEnabled: false }), ["The monitoring visit schedule is turned off. No new monitoring visit can be started."]);
  assert.equal(readinessGateNotices({ writesPaused: true, firstVisitBaselineEnabled: false, scheduleEnabled: false, pilotRestricted: true }).length, 3);
});

test("the approved visit note comes only from the backend's next visit number", () => {
  assert.equal(approvedVisitNote({ nextVisitNumber: 2 }), "Visit 1 approved");
  assert.equal(approvedVisitNote({ nextVisitNumber: 4 }), "Visit 3 approved");
  for (const row of [{ nextVisitNumber: 1 }, { nextVisitNumber: null }, { nextVisitNumber: "2" }, {}, undefined]) assert.equal(approvedVisitNote(row), "");
});

test("a disabled feature and a failed readiness request are different messages, never a raw server message", () => {
  assert.equal(readinessErrorMessage({ status: 409, code: "COHORT_WORKFLOW_DISABLED" }), "Permanent sample tree monitoring is not enabled on the MENRO server yet.");
  for (const error of [{ status: 500, message: "stack at db.js:1" }, { status: 403 }, { status: 409 }, undefined])
    assert.equal(readinessErrorMessage(error), "Visit readiness details could not be loaded. Refresh to try again.");
});
