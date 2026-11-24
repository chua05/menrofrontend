// Read-only Survival Monitoring tracking for Admin-verified Planting Reports.
// Tracking rows are derived on the client from records that already exist (verified planting reports,
// monitoring lifecycles, permanent-sample cohorts and visit readiness). Nothing here creates, registers or
// submits anything: a tracking row is not a monitoring record, carries no observation and is never counted
// in monitoring analytics. Stored monitoring policies are shown as-is and never converted.
import { MONITORING_POLICY, describeMonitoringStatus, monitoringPolicyOf } from "./monitoringStatus.js";
import { readinessStatusLabel } from "./sampleVisitReadiness.js";
import { formatDisplayId } from "./displayId.js";

// Headline monitoring stage of a tracking row (user-facing), mapped only from stored policy, cohort and readiness.
export const TRACKING_STAGE = Object.freeze({
  // Display wording only; tracking rows never enable a submission.
  AWAITING_SETUP: "Awaiting Monitoring Submission",
  AWAITING_SUBMISSION: "Awaiting Submission",
  NOT_YET_AVAILABLE: "Not Yet Available",
  READY_FOR_VISIT: "Ready for Monitoring Visit",
  CHECKING: "Checking Monitoring Setup",
  UNAVAILABLE: "Setup Status Unavailable",
  NOT_AVAILABLE: "Monitoring Not Available",
  UNKNOWN: "Monitoring Requirement Not Recognized",
});
// Legacy aggregate lifecycles open 14 days after the authoritative planting date (backend baseLifecycle rule).
export const LEGACY_START_OFFSET_DAYS = 14;
export const SCHEDULE_LABEL = Object.freeze({ POLICY: "Awaiting Policy Decision", NOT_SCHEDULED: "Not Scheduled" });
const addDays = (date, days) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "";
  const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
export const todayInManila = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// Specific reason shown under the headline stage.
export const TRACKING_STATUS = Object.freeze({
  SPOT_CHECK: "Awaiting MENRO spot-check procedure",
  POLICY_PENDING: "Awaiting MENRO monitoring policy",
  SETUP_PENDING: "Monitoring setup pending",
  SETUP_IN_PROGRESS: "Monitoring setup in progress",
  READY: "Ready for a monitoring visit",
  LEGACY: "Awaiting first observation",
  CHECKING: "Checking monitoring setup…",
  UNAVAILABLE: "Monitoring setup status unavailable",
  NOT_AVAILABLE: "Permanent-sample monitoring not available",
  UNKNOWN: "Monitoring requirement not recognized",
});

export const reportIdOf = (report) => String(report?.id || report?.reportId || "");
// The stored planting report number is authoritative (it also names the report in the visit picker, the row's
// action label and the permanent Tree IDs). A display ID is derived only when no report number is stored.
export const trackingReportNumber = (row) => String(row?.reportNumber || "").trim() || formatDisplayId("RPT", row?.plantingReportId);

// Same eligibility the Survival Monitoring page already applies to verified planting reports.
export function isVerifiedPlantingReport(report) {
  return Boolean(report) && report.archived !== true &&
    (["approved", "verified"].includes(String(report.verificationStatus || "").trim().toLowerCase()) ||
      String(report.reportingProgress || "").trim().toLowerCase() === "completed");
}

function cohortFor(reportId, cohorts) {
  return (Array.isArray(cohorts) ? cohorts : []).find((row) => reportId && String(row?.source?.plantingReportId || "") === reportId) || null;
}

function verifiedQuantity(report, cohort) {
  if (Number.isFinite(cohort?.verifiedPlantedQuantity)) return cohort.verifiedPlantedQuantity;
  if (Number.isFinite(Number(report?.acceptedQuantity)) && report?.acceptedQuantity !== null && report?.acceptedQuantity !== "") return Number(report.acceptedQuantity);
  return null;
}

/**
 * @param {object} input
 * @param {Array} input.reports           planting reports already loaded by the page
 * @param {Array} input.lifecycles        actual monitoring lifecycles (GET /monitoring)
 * @param {Set<string>} [input.visitCohortIds] cohorts that already have a permanent-sample visit row
 * @param {boolean} input.cohortEnabled
 * @param {"idle"|"loading"|"error"|"ready"} input.cohortState
 * @param {Array} [input.cohorts]
 * @param {"idle"|"loading"|"error"|"ready"} input.readinessState
 * @param {object} [input.readiness]
 */
export function deriveTrackingRows({ reports = [], lifecycles = [], visitCohortIds = new Set(), cohortEnabled = false,
  cohortState = "idle", cohorts = [], readinessState = "idle", readiness = null, sites = [], today = todayInManila() } = {}) {
  const siteById = new Map((Array.isArray(sites) ? sites : []).map((site) => [String(site?.id || site?.siteId || ""), site]).filter(([id]) => id));
  // A report that already has an actual monitoring lifecycle (archived or not) is represented by it.
  const tracked = new Set((Array.isArray(lifecycles) ? lifecycles : []).map((record) => String(record?.plantingReportId || "")).filter(Boolean));
  const rows = [];
  const seen = new Set();
  for (const report of Array.isArray(reports) ? reports : []) {
    const reportId = reportIdOf(report);
    if (!reportId || seen.has(reportId) || tracked.has(reportId) || !isVerifiedPlantingReport(report)) continue;
    seen.add(reportId);
    const policy = monitoringPolicyOf(report);
    // The approved purpose policy requires no monitoring for this report.
    if (policy === MONITORING_POLICY.NONE) continue;
    const cohort = cohortState === "ready" ? cohortFor(reportId, cohorts) : null;
    if (cohort && visitCohortIds.has(String(cohort.id))) continue;
    const described = describeMonitoringStatus({ report, cohortEnabled, cohortState, cohorts, readinessState, readiness });
    const readinessEntry = cohort && readinessState === "ready"
      ? (readiness?.cohorts || []).find((row) => String(row?.cohortId || "") === String(cohort.id)) || null : null;

    let status;
    let setup = "";
    if (policy === MONITORING_POLICY.STAFF_SPOT_CHECK) status = TRACKING_STATUS.SPOT_CHECK;
    else if (policy === MONITORING_POLICY.PENDING_MENRO_POLICY) status = TRACKING_STATUS.POLICY_PENDING;
    else if (policy === MONITORING_POLICY.UNKNOWN) status = TRACKING_STATUS.UNKNOWN;
    else if (!cohortEnabled) status = policy === MONITORING_POLICY.LEGACY ? TRACKING_STATUS.LEGACY : TRACKING_STATUS.NOT_AVAILABLE;
    else if (cohortState === "error") status = policy === MONITORING_POLICY.LEGACY ? TRACKING_STATUS.LEGACY : TRACKING_STATUS.UNAVAILABLE;
    else if (cohortState !== "ready") status = policy === MONITORING_POLICY.LEGACY ? TRACKING_STATUS.LEGACY : TRACKING_STATUS.CHECKING;
    else if (!cohort) status = policy === MONITORING_POLICY.LEGACY ? TRACKING_STATUS.LEGACY : TRACKING_STATUS.SETUP_PENDING;
    else {
      const visit = readinessState === "error" || readinessState === "ready" && !readinessEntry ? "Unavailable"
        : readinessState !== "ready" ? "Checking" : readinessEntry.canCreateVisit === true ? "Ready" : "Not ready";
      setup = `Sampling plan: ${readinessStatusLabel(cohort.samplingPlan?.status || "NOT_STARTED")} · Baseline: ${readinessStatusLabel(cohort.baseline?.approvalStatus || cohort.baselineStatus || "NOT_STARTED")} · Visit: ${visit}`;
      status = policy === MONITORING_POLICY.LEGACY ? TRACKING_STATUS.LEGACY
        : readinessEntry?.canCreateVisit === true ? TRACKING_STATUS.READY : TRACKING_STATUS.SETUP_IN_PROGRESS;
    }

    // Headline stage and schedule labels. Only existing rules produce dates: the legacy aggregate
    // +14-day opening and a backend-computed permanent-sample first visit date. Nothing else is scheduled.
    const plantingDate = String(report.plantingDate || report.eventDate || "").slice(0, 10);
    let stage = TRACKING_STAGE.AWAITING_SETUP;
    let startMonitoringDate = "", startLabel = SCHEDULE_LABEL.POLICY;
    if (status === TRACKING_STATUS.CHECKING) stage = TRACKING_STAGE.CHECKING;
    else if (status === TRACKING_STATUS.UNAVAILABLE) stage = TRACKING_STAGE.UNAVAILABLE;
    else if (status === TRACKING_STATUS.NOT_AVAILABLE) stage = TRACKING_STAGE.NOT_AVAILABLE;
    else if (status === TRACKING_STATUS.UNKNOWN) stage = TRACKING_STAGE.UNKNOWN;
    else if (status === TRACKING_STATUS.READY) stage = TRACKING_STAGE.READY_FOR_VISIT;
    else if (policy === MONITORING_POLICY.LEGACY) {
      startMonitoringDate = addDays(plantingDate, LEGACY_START_OFFSET_DAYS);
      if (!startMonitoringDate) { stage = TRACKING_STAGE.AWAITING_SETUP; startLabel = "Planting date not recorded"; }
      else stage = today >= startMonitoringDate ? TRACKING_STAGE.AWAITING_SUBMISSION : TRACKING_STAGE.NOT_YET_AVAILABLE;
    }
    if (!startMonitoringDate && cohort?.samplingReadiness?.firstVisitDueDate && Array.isArray(cohort.samplingReadiness.pending) && !cohort.samplingReadiness.pending.length) {
      startMonitoringDate = cohort.samplingReadiness.firstVisitDueDate;
    }
    const site = siteById.get(String(report.siteId || ""));

    rows.push({
      kind: "tracking",
      plantingReportId: reportId,
      reportNumber: report.reportNumber || "",
      siteName: report.siteName || site?.siteName || site?.name || "",
      barangay: report.barangay || site?.barangay || "",
      plantingDate,
      stage,
      startMonitoringDate,
      startLabel: startMonitoringDate ? "" : startLabel,
      nextLabel: SCHEDULE_LABEL.NOT_SCHEDULED,
      verifiedPlantedQuantity: verifiedQuantity(report, cohort),
      policy,
      requirement: described.requirement,
      status,
      setup,
      notes: described.notes,
      reasons: described.reasons,
      cohort: cohort ? {
        id: cohort.id,
        samplingPlanStatus: readinessStatusLabel(cohort.samplingPlan?.status || "NOT_STARTED"),
        approvedSampleTarget: cohort.samplingPlan?.status === "APPROVED" && Array.isArray(cohort.samplingPlan?.selectedSamples) ? cohort.samplingPlan.selectedSamples.length : null,
        registeredSampleTrees: Array.isArray(cohort.baseline?.sampleUnits) ? cohort.baseline.sampleUnits.length : null,
      } : null,
    });
  }
  return rows;
}

// Applies the existing Monitoring Records filters to a tracking row. Tracking rows have no species,
// condition or monitoring date, so those filters exclude them rather than guessing.
export function trackingMatchesRecordFilters(row, { search = "", site = "All", species = "All", condition = "All", from = "", to = "" } = {}) {
  if (species !== "All" || condition !== "All" || from || to) return false;
  if (site !== "All" && row.siteName !== site) return false;
  const term = String(search || "").trim().toLowerCase();
  if (!term) return true;
  return [row.reportNumber, row.siteName, row.barangay, row.stage, row.status, row.requirement, row.setup, "verified planting report", "tracking"]
    .filter(Boolean).join(" ").toLowerCase().includes(term);
}

// Whether the page needs the cohort and readiness lookups for these tracking candidates.
// Reports that already have an actual monitoring lifecycle never become tracking rows, so they need no lookup.
export function trackingNeedsCohortLookup(reports = [], cohortEnabled = false, lifecycles = []) {
  if (!cohortEnabled) return false;
  const tracked = new Set((Array.isArray(lifecycles) ? lifecycles : []).map((record) => String(record?.plantingReportId || "")).filter(Boolean));
  return (Array.isArray(reports) ? reports : []).some((report) => isVerifiedPlantingReport(report) && !tracked.has(reportIdOf(report)) &&
    [MONITORING_POLICY.PERMANENT_SAMPLE, MONITORING_POLICY.LEGACY].includes(monitoringPolicyOf(report)));
}
