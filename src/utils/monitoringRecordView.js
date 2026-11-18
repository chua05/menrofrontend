// Display helpers for Survival Monitoring lifecycle records.
// A Monitoring ID is shown only when the backend assigned a sequential MON-YYYY-NNN number (from the
// transactional "monitoringRecords_<year>" counter). Document IDs (MON-<hash>) and tracking rows never
// produce a display ID, so nothing that looks like an official number is invented on the client.
export const MONITORING_ID_PATTERN = /^MON-\d{4}-\d{3,}$/;
export const MONITORING_ID_NOT_ASSIGNED = "Not yet assigned";

export function monitoringDisplayId(record) {
  const value = String(record?.monitoringNumber || "").trim().toUpperCase();
  return MONITORING_ID_PATTERN.test(value) ? value : MONITORING_ID_NOT_ASSIGNED;
}

export const hasMonitoringId = (record) => monitoringDisplayId(record) !== MONITORING_ID_NOT_ASSIGNED;

// Registered lifecycle with no approved monitoring schedule yet (backend scheduleStatus).
export const AWAITING_MONITORING_POLICY = "AWAITING_MONITORING_POLICY";
export const isAwaitingMonitoringSetup = (record) => record?.scheduleStatus === AWAITING_MONITORING_POLICY || record?.status === "Awaiting Monitoring Setup";

// Monitoring method stored on a lifecycle (separate from its workflow status).
const METHOD_LABELS = Object.freeze({ STAFF_SPOT_CHECK: "Staff Spot-Check", PERMANENT_SAMPLE: "Permanent Sample Monitoring",
  LEGACY: "Historical Aggregate Monitoring", PENDING_MENRO_POLICY: "Pending MENRO Policy Decision", NONE: "No Monitoring Required" });
export function lifecycleMethodLabel(record) {
  const method = String(record?.monitoringMethod || "").trim();
  if (method) return METHOD_LABELS[method] || "Unrecognized Monitoring Method";
  return "Historical Aggregate Monitoring";
}

// The specific setup blocker shown in Monitoring Record Details for a lifecycle awaiting setup.
export function monitoringSetupBlocker(record) {
  if (!isAwaitingMonitoringSetup(record)) return "";
  const method = String(record?.monitoringMethod || "");
  if (method === "STAFF_SPOT_CHECK") return "MENRO has not yet approved the Staff spot-check procedure and schedule, so no monitoring assessment can be submitted yet.";
  if (method === "PERMANENT_SAMPLE") return "Permanent-sample monitoring setup (sampling plan, baseline and visit scheduling) is not complete, so no monitoring visit can be submitted yet.";
  if (method === "PENDING_MENRO_POLICY") return "MENRO has not yet decided this report's monitoring policy, so no monitoring assessment can be submitted yet.";
  return "The monitoring schedule for this record has not been approved, so no monitoring assessment can be submitted yet.";
}
