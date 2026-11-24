// User-facing text for a failed permanent-sample monitoring API response.
// Raw Firestore errors (e.g. "9 FAILED_PRECONDITION ... console.firebase.google.com ...") are operator
// details and are never shown inside the monitoring form, even if an older backend still returns them.
const INDEX_MESSAGE = "Monitoring visits are temporarily unavailable because a required database index is not ready. Contact the MENRO system administrator.";
const RAW_FIREBASE = /FAILED_PRECONDITION|console\.firebase\.google\.com|requires an index|create_composite/i;
const EVIDENCE_MESSAGES = {
  CAPTURE_LOCATION_INACCURATE: "GPS accuracy is too low. Move to an open area and retake the photo with 50-meter accuracy or better.",
  CAPTURE_LOCATION_OUTSIDE_BULAN: "The verified GPS location is outside the Municipality of Bulan.",
  CAPTURE_LOCATION_OUTSIDE_SITE: "The verified GPS location is outside the assigned planting site.",
  CAPTURE_SITE_GEOMETRY_UNAVAILABLE: "The assigned planting site cannot currently be verified. Try again later.",
  CAPTURE_SESSION_EXPIRED: "The secure camera session expired. Retake the photo.",
  CAPTURE_TIMESTAMP_INVALID: "The photo timestamp is invalid or outside the secure capture window.",
  DUPLICATE_EVIDENCE: "This photo is already registered as evidence. Capture a new photo for this tree.",
  ORIGINAL_GPS_INVALID: "The selected original photo has no valid embedded GPS coordinates.",
  ORIGINAL_OUTSIDE_SITE: "The original photo GPS is outside the assigned planting site.",
  ORIGINAL_OUTSIDE_BULAN: "The original photo GPS is outside the Municipality of Bulan.",
  ORIGINAL_TIMESTAMP_INVALID: "The original photo timestamp is invalid.",
  ORIGINAL_TIMESTAMP_FUTURE: "The original photo timestamp is in the future.",
  ORIGINAL_DUPLICATE: "This original photo is already registered as evidence.",
  ORIGINAL_VERIFICATION_EXPIRED: "Original-photo verification expired. Verify the unchanged photo again.",
  CAPTURE_LOCATION_INVALID: "A valid device GPS location is required. Turn on location services and retake the photo.",
  CAPTURE_SESSION_REPLAYED: "This secure camera capture was already used. Take a new photo for this tree.",
  CAPTURE_IMAGE_MISMATCH: "The photo no longer matches its verified capture. Take a new photo for this tree.",
};
const EVIDENCE_FALLBACK = "The photo could not be saved. Retry, or take a new photo if the problem continues.";

export function monitoringApiErrorMessage(body = {}) {
  if (EVIDENCE_MESSAGES[body.code]) return EVIDENCE_MESSAGES[body.code];
  if (body.code === "COHORT_WORKFLOW_DISABLED") return "Permanent sample tree monitoring is not enabled on the MENRO server yet.";
  if (body.code === "MONITORING_QUERY_INDEX_MISSING") return INDEX_MESSAGE;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return "Monitoring visits could not be loaded.";
  if (RAW_FIREBASE.test(message)) return /index/i.test(message) ? INDEX_MESSAGE : "Monitoring visits could not be loaded.";
  return message;
}

// Evidence uploads: known codes get their recovery message. Unknown codes and every uncoded response
// (including raw Firebase/Storage errors) get the safe upload message: the backend's own wording is never
// shown (ASVS V7), and a failed upload is never described as a failed visit list load.
export function monitoringEvidenceErrorMessage(body = {}) {
  if (EVIDENCE_MESSAGES[body.code] || body.code === "COHORT_WORKFLOW_DISABLED" || body.code === "MONITORING_QUERY_INDEX_MISSING") return monitoringApiErrorMessage(body);
  return EVIDENCE_FALLBACK;
}

// The backend's optimistic-version conflict is a 409 without a code. Only that case becomes the generic
// reload message; coded 409s (missing evidence, locked dead tree, schedule rules, ORIGINAL_*) keep their
// specific, already-mapped message.
export function monitoringWriteErrorMessage(error = {}, reloadMessage) {
  return error.status === 409 && !error.code ? reloadMessage : error.message;
}

// The Tree ID a write error refers to, when the backend names one.
export function monitoringErrorSampleId(error = {}) {
  return (Array.isArray(error.missingSampleIds) && error.missingSampleIds[0]) || error.sampleId || "";
}
