// The requester of a seedling request (a Participant, or a Staff member requesting for themselves).
export function ownsSeedlingRequest(request, user) {
  const uid = user?.uid || user?.id;
  return Boolean(uid && request?.participantId === uid);
}

// Neither the requester nor the Staff encoder of a walk-in may process the request.
export function canProcessSeedlingRequest(request, user) {
  const uid = user?.uid || user?.id;
  return Boolean(uid && !ownsSeedlingRequest(request, user) && request?.walkIn?.encodedBy !== uid);
}

// "My Requests": requests the user is the requester of, or created/submitted as Staff (including a Staff-encoded
// walk-in, whose requester remains the citizen). Mirrors the backend /seedling-requests/my ownership.
export function createdSeedlingRequest(request, user) {
  const uid = user?.uid || user?.id;
  return Boolean(uid && (ownsSeedlingRequest(request, user) || request?.walkIn?.encodedBy === uid || request?.submittedByUid === uid));
}

// Staff-submitted requests (own or walk-in) go directly to Admin approval; they are never Staff-reviewed.
export const STAFF_DIRECT_TO_ADMIN = "STAFF_DIRECT_TO_ADMIN";
export const isStaffDirectRequest = (request) => request?.submissionPath === STAFF_DIRECT_TO_ADMIN;

// A proposed (unregistered) site on a Staff-submitted request is verified by the Admin at approval.
export function needsAdminSiteVerification(request) {
  const workflow = request?.workflow || {};
  return isStaffDirectRequest(request) && workflow.siteMode === "proposed" && !workflow.officialSiteId && !request?.proposedSiteVerification;
}
