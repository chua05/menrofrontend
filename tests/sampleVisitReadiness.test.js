import test from "node:test";
import assert from "node:assert/strict";
import { readinessMessages, readinessTitle, scheduleStatusLabel, withoutEligibleDuplicates } from "../src/utils/sampleVisitReadiness.js";

test("every backend readiness code becomes a plain Staff-facing sentence", () => {
  const messages = readinessMessages([
    { code: "FIRST_VISIT_REGISTERS_BASELINE", sampleTarget: 3 },
    { code: "SPECIES_ALLOCATION_PENDING" },
    { code: "WRITES_PAUSED" },
    { code: "SAMPLING_POLICY_SNAPSHOT_MISSING" },
    { code: "SAMPLING_POLICY_PENDING", pending: ["MINIMUM_SAMPLE_POLICY_PENDING", "FIRST_VISIT_DELAY_PENDING"] },
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
    "The MENRO sampling policy is incomplete: minimum sample size, first visit timing.",
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
