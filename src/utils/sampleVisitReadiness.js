// Plain-language explanations for backend permanent-sample visit readiness codes.
// Messages never identify other Staff members and never expose internal codes.
const STATUS = {
  NOT_STARTED: "Not Started", DRAFT: "Draft", PENDING_ADMIN_APPROVAL: "Pending Admin Review", RETURNED: "Returned for Correction",
  APPROVED: "Approved", REGISTERED: "Registered", REJECTED: "Rejected",
};
const PENDING = {
  MINIMUM_SAMPLE_POLICY_PENDING: "minimum sample size",
  SPECIES_ALLOCATION_PROCEDURE_PENDING: "species allocation procedure",
  PHYSICAL_SELECTION_PROCEDURE_PENDING: "physical selection procedure",
  FIRST_VISIT_DELAY_PENDING: "first visit timing",
};
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
  REPORT_NOT_ELIGIBLE: () => "This planting report no longer satisfies the authoritative first-visit eligibility checks.",
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
  const messages = (Array.isArray(reasons) ? reasons : []).map(reason => (reason && MESSAGES[reason.code] ? MESSAGES[reason.code](reason) : FALLBACK));
  return [...new Set(messages)];
}

export function readinessTitle(cohort = {}) {
  return `${cohort.reportNumber || "Planting report"} · ${cohort.siteName || "Planting site"}`;
}
