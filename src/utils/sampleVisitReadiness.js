// Plain-language explanations for backend permanent-sample visit readiness codes.
// Messages never identify other Staff members and never expose internal codes.
const STATUS = {
  NOT_STARTED: "Not Started", DRAFT: "Draft", PENDING_ADMIN_APPROVAL: "Pending Admin Review", RETURNED: "Returned for Correction",
  APPROVED: "Approved", REGISTERED: "Registered", REJECTED: "Rejected",
};
const PENDING = {
  MINIMUM_SAMPLE_POLICY_PENDING: "minimum sample size",
  SAMPLING_PERCENTAGE_PENDING: "sampling percentage",
  SPECIES_ALLOCATION_PROCEDURE_PENDING: "species allocation procedure",
  PHYSICAL_SELECTION_PROCEDURE_PENDING: "physical selection procedure",
  VISIT_INTERVAL_POLICY_PENDING: "visit interval policy",
  FIRST_VISIT_DELAY_PENDING: "first visit timing",
};
// REPORT_NOT_ELIGIBLE.problems. Nothing here asks anyone to repeat a verification or recreate a report.
const REPORT_PROBLEMS = {
  REPORT_NOT_FOUND: "The planting report for this monitoring setup could not be found.",
  REPORT_NOT_VERIFIED: "The planting report is not verified with an accepted planted quantity.",
  VERIFIED_QUANTITY_CHANGED: "The verified planted quantity changed after the monitoring setup was created.",
  NOT_PERMANENT_SAMPLE_MONITORING: "This planting report uses a different monitoring method, not permanent-sample monitoring.",
  SITE_UNAVAILABLE: "The planting site is missing or inactive.",
  SITE_MISMATCH: "The planting report and its monitoring setup name different planting sites.",
  POLICY_CONFLICT: "This planting report has conflicting monitoring methods on record. MENRO must resolve them before monitoring can start.",
};
const REPORT_PROBLEM_FALLBACK = "This planting report no longer satisfies the authoritative first-visit eligibility checks.";
const reportProblems = problems => (Array.isArray(problems) && problems.length
  ? problems.map(code => (Object.hasOwn(REPORT_PROBLEMS, code) ? REPORT_PROBLEMS[code] : REPORT_PROBLEM_FALLBACK)) : [REPORT_PROBLEM_FALLBACK]);
// While first-visit registration is off, these legacy blockers would misdescribe a cohort that never used them.
const LEGACY_SETUP_CODES = new Set(["SAMPLING_POLICY_SNAPSHOT_MISSING", "SAMPLING_PLAN_NOT_APPROVED", "BASELINE_NOT_APPROVED"]);
const status = value => STATUS[value] || "Not available";
export const readinessStatusLabel = status;
// Backend schedule statuses (permanentSampleSchedule.scheduleStatus) and readiness monitoring statuses.
const SCHEDULE_STATUS = {
  POLICY_PENDING: "Pending Official Schedule", SCHEDULED: "Scheduled", DUE: "Due", OVERDUE: "Overdue", AVAILABLE: "Available",
  FIRST_VISIT_AVAILABLE: "First Visit Available",
};
export const scheduleStatusLabel = value => SCHEDULE_STATUS[value] || STATUS[value] || "Pending";
// The visit picker lists eligible readiness rows and Setup Pending tracking rows. A report whose cohort is already
// eligible appears only once, as the eligible (selectable) row.
export function withoutEligibleDuplicates(pendingReports = [], eligibleRows = []) {
  const cohortIds = new Set(eligibleRows.map(row => String(row?.cohortId || "")).filter(Boolean));
  const reportIds = new Set(eligibleRows.map(row => String(row?.context?.plantingReportId || "")).filter(Boolean));
  return pendingReports.filter(row => !cohortIds.has(String(row?.cohort?.id || "")) && !reportIds.has(String(row?.plantingReportId || "")));
}
const MESSAGES = {
  FIRST_VISIT_REGISTERS_BASELINE: reason => `Visit 1 will register the baseline and ${reason.sampleTarget ?? "the automatic 10% sample"} permanent sample tree${reason.sampleTarget === 1 ? "" : "s"}. Tree IDs remain provisional until Admin approval.`,
  REPORT_NOT_ELIGIBLE: reason => reportProblems(reason.problems),
  FIRST_VISIT_POLICY_DISABLED: () => "MENRO has not enabled first-visit baseline registration, so Visit 1 cannot be started for this report yet.",
  SPECIES_ALLOCATION_PENDING: () => "Multi-species permanent-sample allocation is awaiting an approved MENRO procedure.",
  FIRST_VISIT_PLAN_UNAVAILABLE: () => "The first-visit sample plan cannot be prepared from the authoritative report data.",
  WRITES_PAUSED: () => "Permanent-sample changes are currently paused by MENRO.",
  SAMPLING_POLICY_SNAPSHOT_MISSING: () => "This planting report has no MENRO-approved sampling policy.",
  SAMPLING_POLICY_PENDING: reason => `The MENRO sampling policy is incomplete: ${(reason.pending || []).map(code => PENDING[code] || "other policy details").join(", ") || "policy details"}.`,
  SAMPLING_PLAN_NOT_APPROVED: reason => `The sampling plan is not approved yet (current status: ${status(reason.planStatus)}).`,
  TEST_ONLY_SAMPLING_POLICY: () => "The sampling plan uses a test-only rule and must be replaced under an approved MENRO policy.",
  BASELINE_NOT_APPROVED: reason => `The permanent sample baseline is not approved yet (current status: ${status(reason.baselineStatus)}).`,
  OPEN_VISIT_EXISTS: reason => reason.ownedByYou
    ? `You already have an open visit for this site (${status(reason.visitStatus)}). Continue it from the visit list.`
    : `Another Staff member has an open visit for this site (${status(reason.visitStatus)}).`,
  VISIT_SCHEDULING_POLICY_PENDING: () => "New monitoring visits can start only after MENRO approves the visit scheduling policy.",
  VISIT_NOT_OPEN: reason => reason.openingDate
    ? `The next monitoring visit opens on ${reason.openingDate}.`
    : "The next monitoring visit is not open yet.",
  APPROVED_VISIT_SCHEDULE_INCOMPLETE: () => "The approved visit history does not contain enough scheduling information to open the next visit.",
};
const FALLBACK = "This site is not ready for permanent-sample monitoring.";

export function readinessMessages(reasons = []) {
  const list = Array.isArray(reasons) ? reasons : [];
  const firstVisitOff = list.some(reason => reason?.code === "FIRST_VISIT_POLICY_DISABLED");
  const messages = list.filter(reason => !(firstVisitOff && LEGACY_SETUP_CODES.has(reason?.code)))
    .flatMap(reason => (reason && MESSAGES[reason.code] ? MESSAGES[reason.code](reason) : FALLBACK));
  return [...new Set(messages)];
}

export function readinessTitle(cohort = {}) {
  return `${cohort.reportNumber || "Planting report"} · ${cohort.siteName || "Planting site"}`;
}

// Global gates from the readiness response: one short notice each, only for an explicit paused/off value.
export function readinessGateNotices(gates) {
  return [
    gates?.writesPaused === true && "MENRO has paused permanent-sample monitoring changes. Nothing can be started, saved or submitted until it resumes.",
    gates?.firstVisitBaselineEnabled === false && "First-visit baseline registration is turned off. Reports without an approved baseline cannot start Visit 1.",
    gates?.scheduleEnabled === false && "The monitoring visit schedule is turned off. No new monitoring visit can be started.",
  ].filter(Boolean);
}

// The backend's next visit number is one more than the approved visits.
export const approvedVisitNote = row => (Number.isInteger(row?.nextVisitNumber) && row.nextVisitNumber > 1 ? `Visit ${row.nextVisitNumber - 1} approved` : "");

export const readinessErrorMessage = error => (error?.code === "COHORT_WORKFLOW_DISABLED"
  ? "Permanent sample tree monitoring is not enabled on the MENRO server yet."
  : "Visit readiness details could not be loaded. Refresh to try again.");
