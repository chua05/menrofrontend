// Read-only Monitoring Status for a verified Planting Report (Staff/Admin details drawer).
// Everything shown is derived from the report's stored reportingPolicy and the existing
// backend cohort list and visit-readiness responses. Nothing is inferred: no cohort IDs are
// computed, and no approvals, visits or MENRO policy values are assumed.
import { readinessMessages, readinessStatusLabel } from "./sampleVisitReadiness.js";

export const MONITORING_POLICY = Object.freeze({
  LEGACY: "LEGACY",
  NONE: "NONE",
  STAFF_SPOT_CHECK: "STAFF_SPOT_CHECK",
  PERMANENT_SAMPLE: "PERMANENT_SAMPLE",
  // Approved request whose purpose/organization policy MENRO has not set yet: not exempt, not authorized.
  PENDING_MENRO_POLICY: "PENDING_MENRO_POLICY",
  UNKNOWN: "UNKNOWN",
});

// Reports without a purpose-policy snapshot predate purpose policies and keep the historical
// aggregate workflow. The backend also allows them a permanent-sample cohort.
export function monitoringPolicyOf(report = {}) {
  const policy = report?.reportingPolicy;
  if (!policy) return MONITORING_POLICY.LEGACY;
  const value = policy.monitoring;
  return [MONITORING_POLICY.NONE, MONITORING_POLICY.STAFF_SPOT_CHECK, MONITORING_POLICY.PERMANENT_SAMPLE, MONITORING_POLICY.PENDING_MENRO_POLICY].includes(value)
    ? value : MONITORING_POLICY.UNKNOWN;
}

// Whether the drawer should ask the backend for this report's cohort and readiness.
export function needsCohortLookup(report, cohortEnabled) {
  const policy = monitoringPolicyOf(report);
  return Boolean(cohortEnabled) && (policy === MONITORING_POLICY.PERMANENT_SAMPLE || policy === MONITORING_POLICY.LEGACY);
}

const REQUIREMENT_LABEL = {
  LEGACY: "Historical Aggregate Monitoring",
  NONE: "No Monitoring Required",
  STAFF_SPOT_CHECK: "Staff Spot-Check",
  PERMANENT_SAMPLE: "Permanent Sample Monitoring",
  PENDING_MENRO_POLICY: "Pending MENRO Policy Decision",
  UNKNOWN: "Unrecognized Monitoring Method",
};

function cohortRows(cohort, readinessEntry, readinessState) {
  const rows = [
    { label: "Cohort", value: cohort.id },
    { label: "Sampling plan", value: readinessStatusLabel(cohort.samplingPlan?.status || "NOT_STARTED") },
    { label: "Baseline", value: readinessStatusLabel(cohort.baseline?.approvalStatus || cohort.baselineStatus || "NOT_STARTED") },
  ];
  let visit;
  if (readinessState === "loading") visit = "Checking visit readiness…";
  else if (readinessState === "error" || !readinessEntry) visit = "Visit readiness is unavailable.";
  else if (readinessEntry.canCreateVisit === true) visit = "Ready for a monitoring visit.";
  else visit = "Not ready for a monitoring visit.";
  rows.push({ label: "Visit readiness", value: visit });
  return rows;
}

/**
 * @param {object} input
 * @param {object} input.report               verified planting report
 * @param {boolean} input.cohortEnabled       VITE cohort gate
 * @param {"idle"|"loading"|"error"|"ready"} input.cohortState
 * @param {Array} [input.cohorts]             GET /verified-planting-cohorts data
 * @param {"idle"|"loading"|"error"|"ready"} input.readinessState
 * @param {object} [input.readiness]          GET /verified-sample-monitoring/readiness data
 */
export const monitoringMethodLabel = (policy) => REQUIREMENT_LABEL[policy] || REQUIREMENT_LABEL.UNKNOWN;

export function describeMonitoringStatus({ report, cohortEnabled, cohortState = "idle", cohorts = [], readinessState = "idle", readiness = null }) {
  const policy = monitoringPolicyOf(report);
  const result = { policy, requirement: REQUIREMENT_LABEL[policy], notes: [], rows: [], reasons: [] };

  if (policy === MONITORING_POLICY.NONE) {
    result.notes.push("The approved purpose policy does not require monitoring for this report.");
    return result;
  }
  if (policy === MONITORING_POLICY.STAFF_SPOT_CHECK) {
    result.notes.push("Monitoring workflow pending MENRO policy. Staff spot-check procedures, schedule and evidence rules have not been approved, so no monitoring visit or observation can be recorded for this report yet.");
    result.notes.push("Staff spot-check reports do not receive a permanent-sample cohort.");
    return result;
  }
  if (policy === MONITORING_POLICY.PENDING_MENRO_POLICY) {
    result.notes.push("MENRO has not yet decided the reporting and monitoring policy for this purpose or requester type. Monitoring is neither waived nor authorized, so no cohort, monitoring visit or observation can be recorded until MENRO sets it.");
    return result;
  }
  if (policy === MONITORING_POLICY.UNKNOWN) {
    result.notes.push("This report's monitoring requirement is not recognized. Contact the MENRO system administrator.");
    return result;
  }
  if (policy === MONITORING_POLICY.LEGACY) {
    result.notes.push("Follow-up observations use the historical aggregate monitoring workflow in Survival Monitoring.");
  }
  if (!cohortEnabled) {
    if (policy === MONITORING_POLICY.PERMANENT_SAMPLE) result.notes.push("Permanent-sample monitoring is not available in this environment.");
    return result;
  }
  if (cohortState === "loading" || cohortState === "idle") { result.notes.push("Checking permanent-sample status…"); return result; }
  if (cohortState === "error") { result.notes.push("Permanent-sample status could not be loaded. Refresh to try again."); return result; }

  const reportId = String(report?.id || "");
  const cohort = (Array.isArray(cohorts) ? cohorts : []).find(row => reportId && String(row?.source?.plantingReportId || "") === reportId);
  if (!cohort) {
    if (policy === MONITORING_POLICY.PERMANENT_SAMPLE) {
      result.notes.push("No permanent-sample cohort exists for this report. Monitoring cannot start until one is created through the approved verification workflow.");
    }
    return result;
  }
  const readinessEntry = readinessState === "ready"
    ? (readiness?.cohorts || []).find(row => String(row?.cohortId || "") === String(cohort.id)) : null;
  result.rows = cohortRows(cohort, readinessEntry, readinessState);
  if (readinessEntry && readinessEntry.canCreateVisit !== true) result.reasons = readinessMessages(readinessEntry.reasons);
  return result;
}
