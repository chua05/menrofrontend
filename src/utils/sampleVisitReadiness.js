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
const MESSAGES = {
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
};
const FALLBACK = "This site is not ready for permanent-sample monitoring.";

export function readinessMessages(reasons = []) {
  const messages = (Array.isArray(reasons) ? reasons : []).map(reason => (reason && MESSAGES[reason.code] ? MESSAGES[reason.code](reason) : FALLBACK));
  return [...new Set(messages)];
}

export function readinessTitle(cohort = {}) {
  return `${cohort.reportNumber || "Planting report"} · ${cohort.siteName || "Planting site"}`;
}
