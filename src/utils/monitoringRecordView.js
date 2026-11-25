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
export const AWAITING_SETUP_STATUS = "Awaiting Monitoring Setup";
export const isAwaitingMonitoringSetup = (record) => record?.scheduleStatus === AWAITING_MONITORING_POLICY || record?.status === AWAITING_SETUP_STATUS;

// Presentation only: the backend status value (used by analytics and eligibility checks) is unchanged.
// Display wording never grants a submission; actions still follow isAwaitingMonitoringSetup and RBAC.
export const AWAITING_SUBMISSION_LABEL = "Awaiting First Monitoring Visit";
export function monitoringStatusLabel(status) {
  const value = String(status || "").trim();
  return value === AWAITING_SETUP_STATUS ? AWAITING_SUBMISSION_LABEL : value;
}

// Badge tone for a displayed lifecycle/tracking status, reusing the MENRO record badge palette.
const STATUS_TONES = Object.freeze({
  "Monitoring Completed": "complete", "Monitoring Visit Approved": "complete",
  "Monitoring Overdue": "pending",
  "Available for Monitoring": "active", "Ready for Monitoring Visit": "active", "Next Monitoring Scheduled": "active",
  [AWAITING_SUBMISSION_LABEL]: "pending", "Awaiting Submission": "pending", "Not Yet Available": "pending", "Checking Monitoring Setup": "pending",
});
export const monitoringStatusTone = (label) => STATUS_TONES[String(label || "").trim()] || (/^Visit \d+: /.test(String(label || "")) ? "pending" : "default");

// Dates, status and Staff action of one existing lifecycle. The MON record itself is never changed: permanent-sample values
// come from the backend's read-only `permanentSample` link. Without a submitted visit there is no start date and no schedule.
const VISIT_STATUS = Object.freeze({ DRAFT: "Draft", RETURNED: "Returned for Correction", PENDING_ADMIN_APPROVAL: "Pending Admin Review" });
const NEXT_STATUS = Object.freeze({ SCHEDULED: "Next Monitoring Scheduled", DUE: "Available for Monitoring", OVERDUE: "Monitoring Overdue" });
export function lifecycleMonitoringView(record) {
  const sample = record?.permanentSample || null;
  if (!sample || !sample.openVisit && !sample.approvedVisits) {
    if (!isAwaitingMonitoringSetup(record)) return null;
    return { start: "", startNote: "", next: "", nextNote: "", status: AWAITING_SUBMISSION_LABEL, latest: "", condition: "", action: "Start Visit 1", visitNumber: 1 };
  }
  const open = sample.openVisit, number = sample.nextVisitNumber || 1;
  const latest = sample.latest;
  // Latest approved sample condition, with the same order the aggregate records use; nothing unapproved is shown.
  const condition = !latest ? "" : latest.needsRechecking > 0 ? "Needs Rechecking" : latest.total > 0 && latest.confirmedDead === latest.total ? "Dead"
    : latest.damaged > 0 || latest.confirmedDead > 0 ? "Damaged" : "Healthy";
  return {
    condition, start: sample.startMonitoringDate || "", startNote: sample.startProvisional ? "Pending Admin Review" : "",
    next: sample.nextMonitoringDate || "", nextNote: sample.nextMonitoringDate ? `Visit ${sample.approvedVisits + 1}` : "",
    status: open ? `Visit ${open.visitNumber || number}: ${VISIT_STATUS[open.status] || open.status}` : NEXT_STATUS[sample.nextStatus] || "Monitoring Visit Approved",
    latest: !latest ? "" : latest.survivalRate == null ? `Visit ${latest.visitNumber}: rechecking pending` : `Visit ${latest.visitNumber}: ${latest.survivalRate}% sample survival`,
    action: open ? open.ownedByYou ? (open.status === "PENDING_ADMIN_APPROVAL" ? `View Visit ${number}` : `Continue Visit ${number}`) : "" : ["DUE", "OVERDUE"].includes(sample.nextStatus) ? `Start Visit ${number}` : "Monitor Planted Trees",
    visitNumber: number,
  };
}

// Monitoring method stored on a lifecycle (separate from its workflow status).
const METHOD_LABELS = Object.freeze({ STAFF_SPOT_CHECK: "Staff Spot-Check", PERMANENT_SAMPLE: "Permanent Sample Monitoring",
  LEGACY: "Historical Aggregate Monitoring", PENDING_MENRO_POLICY: "Pending MENRO Policy Decision", NONE: "No Monitoring Required" });
export function lifecycleMethodLabel(record) {
  const method = String(record?.monitoringMethod || "").trim();
  if (method) return METHOD_LABELS[method] || "Unrecognized Monitoring Method";
  return "Historical Aggregate Monitoring";
}

// The specific setup blocker shown in Monitoring Record Details for a lifecycle awaiting setup.
// Staff Spot-Check shows no policy explanation (requested UI simplification); submission stays blocked
// by isAwaitingMonitoringSetup and the backend regardless of this text.
export function monitoringSetupBlocker(record) {
  // A linked permanent-sample state means the first visit needs no separate setup.
  if (!isAwaitingMonitoringSetup(record) || record.permanentSample) return "";
  const method = String(record?.monitoringMethod || "");
  if (method === "STAFF_SPOT_CHECK") return "";
  if (method === "PERMANENT_SAMPLE") return "Permanent-sample monitoring setup (sampling plan, baseline and visit scheduling) is not complete, so no monitoring visit can be submitted yet.";
  if (method === "PENDING_MENRO_POLICY") return "MENRO has not yet decided this report's monitoring policy, so no monitoring assessment can be submitted yet.";
  return "The monitoring schedule for this record has not been approved, so no monitoring assessment can be submitted yet.";
}
