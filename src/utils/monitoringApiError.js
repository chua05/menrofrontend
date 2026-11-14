// User-facing text for a failed permanent-sample monitoring API response.
// Raw Firestore errors (e.g. "9 FAILED_PRECONDITION ... console.firebase.google.com ...") are operator
// details and are never shown inside the monitoring form, even if an older backend still returns them.
const INDEX_MESSAGE = "Monitoring visits are temporarily unavailable because a required database index is not ready. Contact the MENRO system administrator.";
const RAW_FIREBASE = /FAILED_PRECONDITION|console\.firebase\.google\.com|requires an index|create_composite/i;

export function monitoringApiErrorMessage(body = {}) {
  if (body.code === "COHORT_WORKFLOW_DISABLED") return "Permanent sample tree monitoring is not enabled on the MENRO server yet.";
  if (body.code === "MONITORING_QUERY_INDEX_MISSING") return INDEX_MESSAGE;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return "Monitoring visits could not be loaded.";
  if (RAW_FIREBASE.test(message)) return /index/i.test(message) ? INDEX_MESSAGE : "Monitoring visits could not be loaded.";
  return message;
}
