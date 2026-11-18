// Read-only Survival Monitoring tracking for Admin-verified Planting Reports.
// Tracking rows are derived on the client from records that already exist (verified planting reports,
// monitoring lifecycles, permanent-sample cohorts and visit readiness). Nothing here creates, registers or
// submits anything: a tracking row is not a monitoring record, carries no observation and is never counted
// in monitoring analytics. Stored monitoring policies are shown as-is and never converted.
import { MONITORING_POLICY, describeMonitoringStatus, monitoringPolicyOf } from "./monitoringStatus.js";
import { readinessStatusLabel } from "./sampleVisitReadiness.js";

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
  cohortState = "idle", cohorts = [], readinessState = "idle", readiness = null } = {}) {
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

    rows.push({
      kind: "tracking",
      plantingReportId: reportId,
      reportNumber: report.reportNumber || "",
      siteName: report.siteName || "",
      barangay: report.barangay || "",
      plantingDate: String(report.plantingDate || report.eventDate || "").slice(0, 10),
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
  return [row.reportNumber, row.siteName, row.barangay, row.status, row.requirement, row.setup, "verified planting report", "tracking"]
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
