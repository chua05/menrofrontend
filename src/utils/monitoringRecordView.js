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
