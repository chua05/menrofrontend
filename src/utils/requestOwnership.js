// The requester of a seedling request (a Participant, or a Staff member requesting for themselves).
export function ownsSeedlingRequest(request, user) {
  const uid = user?.uid || user?.id;
  return Boolean(uid && request?.participantId === uid);
}

// Review, return, approval and rejection: never the requester or the Staff encoder of a walk-in.
export function canProcessSeedlingRequest(request, user) {
  const uid = user?.uid || user?.id;
  return Boolean(uid && !ownsSeedlingRequest(request, user) && request?.walkIn?.encodedBy !== uid);
}

// Releasing an Admin-approved request is fulfilment, not approval: the Staff encoder of a walk-in may do it, never the
// requester and never an officer who both encoded and approved it. The backend enforces the same rule.
export function canReleaseSeedlingRequest(request, user) {
  const uid = user?.uid || user?.id;
  return Boolean(uid && request && !ownsSeedlingRequest(request, user) && !(request.walkIn?.encodedBy === uid && request.approvedBy === uid));
}

// Stated only after release, from the policy stored at release. Staff submit only for walk-in citizens (no account).
const REPORT_REQUIREMENT = {
  REQUIRED: { label: "Planting Report Required", staffAction: "Submit Planting Report" },
  OPTIONAL: { label: "Planting Report Optional", staffAction: "Submit Planting Report (Optional)" },
  NOT_REQUIRED: { label: "No Planting Report Required", staffAction: null },
  PENDING_POLICY: { label: "Reporting Policy Pending", staffAction: null },
};
export function plantingReportRequirement(request) {
  if (!["Released", "Saplings Released"].includes(request?.status)) return null;
  const rule = REPORT_REQUIREMENT[request.reportingPolicy?.reporting];
  return rule ? { label: rule.label, staffAction: request.walkIn ? rule.staffAction : null } : null;
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
