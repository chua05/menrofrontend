// Planting report review workflow shared by the report list, View Report and
// decision modals. Mirrors backend src/utils/plantingReviewWorkflow.util.js.
//
//   Participant: Pending Review -> Reviewed (Staff forwards) -> Completed | Rejected (Admin)
//                Pending Review -> Returned for Correction (Staff) -> corrected resubmission
//   Staff:       Pending Admin Approval -> Completed | Rejected | Returned for Correction (Admin)

export const WORKFLOW_STATUS = Object.freeze({
  PENDING_REVIEW: "Pending Review",
  REVIEWED: "Reviewed",
  PENDING_ADMIN_APPROVAL: "Pending Admin Approval",
  RETURNED: "Returned for Correction",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
});

const KNOWN = new Set(Object.values(WORKFLOW_STATUS));
export const MAX_DECISION_REASON_LENGTH = 1000;

// Records saved before the workflow field existed derive their stage from the
// quantity ledger, exactly as the backend does; nothing is rewritten.
export function submissionWorkflowStatus(submission = {}) {
  if (KNOWN.has(submission.workflowStatus)) return submission.workflowStatus;
  const official = submission.officialStaffReport === true;
  const review = String(submission.staffReviewStatus || "").trim();
  if (["Accepted", "Approved", "Not Required"].includes(review)) return WORKFLOW_STATUS.COMPLETED;
  if (review === "Rejected") return official ? WORKFLOW_STATUS.RETURNED : WORKFLOW_STATUS.REJECTED;
  return official ? WORKFLOW_STATUS.PENDING_ADMIN_APPROVAL : WORKFLOW_STATUS.PENDING_REVIEW;
}

// Status colors: Pending Review and Returned (amber), Reviewed and Pending
// Admin Approval (blue), Completed (green), Rejected (red).
export const WORKFLOW_STATUS_CLASS = Object.freeze({
  [WORKFLOW_STATUS.PENDING_REVIEW]: "pr-status-pending",
  [WORKFLOW_STATUS.REVIEWED]: "pr-status-reviewed",
  [WORKFLOW_STATUS.PENDING_ADMIN_APPROVAL]: "pr-status-reviewed",
  [WORKFLOW_STATUS.RETURNED]: "pr-status-returned",
  [WORKFLOW_STATUS.COMPLETED]: "pr-status-approved",
  [WORKFLOW_STATUS.REJECTED]: "pr-status-rejected",
});

export const DECISIONS = Object.freeze({
  forward: {
    endpoint: "forward",
    title: "Forward to Admin for Approval?",
    subtitle: "Confirm that you reviewed the submitted details, photos and GPS verification. The MENRO Admin makes the final decision.",
    confirm: "Forward to Admin",
    busy: "Forwarding...",
    reasonLabel: "Review Comments",
    reasonRequired: false,
    placeholder: "Optional comments for the MENRO Admin",
    tone: "primary",
    success: "Planting report reviewed and forwarded to the MENRO Admin for approval.",
  },
  return: {
    endpoint: "return",
    title: "Return for Correction",
    subtitle: "The submitter will be notified and can correct and resubmit this report.",
    confirm: "Return for Correction",
    busy: "Returning...",
    reasonLabel: "Reason for Return",
    reasonRequired: true,
    placeholder: "Explain what the submitter must correct",
    missing: "Enter the reason for returning this planting report.",
    tone: "warning",
    success: "Planting report returned for correction.",
  },
  approve: {
    endpoint: "approve",
    title: "Approve Planting Report?",
    subtitle: "Approval marks this submission Completed, confirms the planted quantity and makes it eligible for survival monitoring.",
    confirm: "Approve Report",
    busy: "Approving...",
    reasonLabel: "Approval Remarks",
    reasonRequired: false,
    placeholder: "Optional remarks",
    tone: "primary",
    success: "Planting report approved. Planted quantities are confirmed.",
  },
  reject: {
    endpoint: "reject",
    title: "Reject Planting Report",
    subtitle: "Rejection is final. The submitter will be notified and this submission cannot be corrected.",
    confirm: "Reject Report",
    busy: "Rejecting...",
    reasonLabel: "Reason for Rejection",
    reasonRequired: true,
    placeholder: "Explain why this planting report is rejected",
    missing: "Enter the reason for rejecting this planting report.",
    tone: "danger",
    success: "Planting report rejected.",
  },
});

// Which decisions the signed-in role may take on one submission. The backend
// enforces the same rules; this only decides which buttons are shown.
export function availableDecisions(submission, role) {
  if (!submission) return [];
  const status = submissionWorkflowStatus(submission);
  const official = submission.officialStaffReport === true;
  if (role === "staff" && !official && status === WORKFLOW_STATUS.PENDING_REVIEW) return ["forward", "return"];
  if (role === "admin" && !official && status === WORKFLOW_STATUS.REVIEWED) return ["approve", "reject"];
  if (role === "admin" && official && status === WORKFLOW_STATUS.PENDING_ADMIN_APPROVAL) return ["approve", "reject", "return"];
  return [];
}

export function decisionReasonError(decision, value) {
  const config = DECISIONS[decision];
  const reason = String(value || "").trim();
  if (config?.reasonRequired && !reason) return config.missing;
  if (reason.length > MAX_DECISION_REASON_LENGTH) return `Use at most ${MAX_DECISION_REASON_LENGTH} characters.`;
  return "";
}

export function waitingMessage(submission, role) {
  const status = submissionWorkflowStatus(submission);
  if (status === WORKFLOW_STATUS.PENDING_REVIEW) return role === "admin" ? "Awaiting MENRO Staff review before Admin approval." : "Awaiting MENRO Staff review.";
  if (status === WORKFLOW_STATUS.REVIEWED || status === WORKFLOW_STATUS.PENDING_ADMIN_APPROVAL) return "Awaiting MENRO Admin approval.";
  return "";
}

// Evidence state shown on the map and photo cards: evidence from a rejected
// or returned submission is "rejected"; otherwise it is verified only when
// every saved GPS, site and timestamp check passed.
export function evidenceState(photo = {}, submission = {}) {
  const status = submissionWorkflowStatus(submission);
  if (status === WORKFLOW_STATUS.REJECTED || status === WORKFLOW_STATUS.RETURNED || submission.verificationStatus === "Invalid") return "rejected";
  const checks = [photo.gpsValid, photo.siteGpsValid, photo.timestampValid];
  if (checks.every((value) => value === true)) return "verified";
  if (photo.automatedStatus === "Passed Automated Check" && !checks.includes(false)) return "verified";
  return "unverified";
}

export const EVIDENCE_STATE_LABEL = Object.freeze({
  verified: "Verified Evidence",
  unverified: "Unverified Evidence",
  rejected: "Rejected / Returned Evidence",
});

const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function photoCoordinates(photo = {}) {
  const latitude = finite(photo.latitude ?? photo.metadata?.latitude);
  const longitude = finite(photo.longitude ?? photo.metadata?.longitude);
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude, accuracy: finite(photo.locationAccuracyMeters ?? photo.gpsAccuracyMeters ?? photo.accuracy) };
}

// One marker per saved photo GPS point; photos without coordinates are listed
// separately by the caller instead of being placed at a guessed location.
export function buildEvidenceMarkers(submissions = []) {
  const markers = [];
  submissions.forEach((submission) => {
    (submission.indexedPhotos || submission.photos || []).forEach((photo, index) => {
      const coordinates = photoCoordinates(photo);
      if (!coordinates) return;
      markers.push({
        ...coordinates,
        id: `${submission.id}-${photo.reportPhotoIndex ?? index}`,
        label: `Photo ${(photo.reportPhotoIndex ?? index) + 1}`,
        submissionId: submission.id,
        state: evidenceState(photo, submission),
        capturedAt: photo.photoCapturedAt || photo.metadata?.capturedAt || null,
      });
    });
  });
  return markers;
}

// Verification log entries arrive oldest first; keep that order and only the
// fields the history timeline shows.
export function historyEntries(logs = []) {
  return (Array.isArray(logs) ? logs : []).map((log, index) => ({
    id: log.id || `log-${index}`,
    action: log.action || "Status Updated",
    from: log.previousStatus || "",
    to: log.newStatus || "",
    by: log.performedByName || log.performedBy || "",
    role: log.performedByRole || "",
    remarks: log.remarks || "",
    submissionId: log.submissionId || "",
    createdAt: log.createdAt || null,
    tone: /reject/i.test(log.action || "") ? "rejected" : /return/i.test(log.action || "") ? "returned" : "default",
  }));
}
