// Reconciles a participant planting report whose submission timed out after it
// was sent. Before the attempt, the page records the submission IDs it already
// knows for the event; afterwards, a new pending submission by the same
// participant for that event means MENRO saved the report.
const sameEvent = (report, eventId) => Boolean(eventId) &&
  (String(report?.eventId || "") === String(eventId) || report?.id === `event_${eventId}`);

const submissionsFor = (records, eventId) => (Array.isArray(records) ? records : [])
  .filter(report => sameEvent(report, eventId))
  .flatMap(report => Array.isArray(report.submissions) ? report.submissions : []);

export function ownSubmissionIdsForEvent(records, eventId) {
  return [...new Set(submissionsFor(records, eventId).map(submission => submission?.id).filter(Boolean))];
}

export function findReconciledSubmission(records, { eventId, knownSubmissionIds = [], contributorId = "" } = {}) {
  const known = new Set(knownSubmissionIds);
  return submissionsFor(records, eventId).find(submission => submission?.id && !known.has(submission.id) &&
    (!contributorId || submission.contributorId === contributorId) &&
    String(submission.staffReviewStatus || "Pending Review") === "Pending Review") || null;
}

// Any pending submission of this participant for the event. Used when MENRO
// refuses a submission (409): if the participant already has a report for the
// event awaiting review, that is the reason, not a changed balance.
export function findOwnPendingSubmission(records, { eventId, contributorId = "" } = {}) {
  if (!contributorId) return null;
  return submissionsFor(records, eventId).find(submission => submission?.id &&
    submission.contributorId === contributorId &&
    String(submission.staffReviewStatus || "Pending Review") === "Pending Review") || null;
}
