// Display rules for aggregate (legacy) monitoring observation actions. The backend
// enforces the same rules; these only decide which buttons are shown.
export const RETURNED_STATUS = "Returned for Rechecking";
export const PENDING_STATUS = "Pending Review";

// Everyone who reported or resubmitted the observation.
export function observationReporterIds(entry) {
  return new Set([entry?.originalReporterId, entry?.monitoredBy,
    ...(Array.isArray(entry?.revisionHistory) ? entry.revisionHistory.map((revision) => revision?.submittedBy) : [])]
    .filter((value) => typeof value === "string" && value));
}

const workflowEntry = (entry) => Number(entry?.workflowVersion) >= 2;
const knownUser = (userId) => typeof userId === "string" && userId.length > 0;

// Only the original Staff reporter corrects and resubmits a returned observation.
export function canResubmitObservation({ entry, role, userId }) {
  return role === "staff" && knownUser(userId) && workflowEntry(entry) &&
    entry.reviewStatus === RETURNED_STATUS && entry.originalReporterId === userId;
}

// Staff review a pending observation only when they did not report it themselves.
export function canStaffReviewObservation({ entry, role, userId }) {
  return role === "staff" && knownUser(userId) && workflowEntry(entry) &&
    entry.reviewStatus === PENDING_STATUS && !observationReporterIds(entry).has(userId);
}

export function isOwnPendingObservation({ entry, role, userId }) {
  return role === "staff" && knownUser(userId) && workflowEntry(entry) &&
    entry.reviewStatus === PENDING_STATUS && observationReporterIds(entry).has(userId);
}
