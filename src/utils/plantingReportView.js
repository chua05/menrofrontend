// View-model helpers for Staff/Admin/Participant "View Report".
// Submission progress ("Submitted") is deliberately separate from Staff review
// ("Pending Review" until a Staff decision). Neither implies Approved/Completed.

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const seconds = value._seconds ?? value.seconds;
  if (Number.isFinite(Number(seconds))) return Number(seconds) * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function reportSubmissions(record) {
  return Array.isArray(record?.submissions) ? record.submissions : [];
}

export function reportSubmissionStatus(record) {
  if (!record) return "Awaiting Submission";
  if (record.reportType !== "parent") return "Submitted";
  if (record.submissionStatus === "Submitted" || reportSubmissions(record).length > 0) return "Submitted";
  return "Awaiting Submission";
}

// Review stages follow the staged workflow (Pending Review -> Reviewed ->
// Completed | Rejected, Returned for Correction, Pending Admin Approval).
// The earliest unfinished stage wins, matching the backend's reviewStatus.
const REVIEW_STAGE_ORDER = ["Pending Review", "Pending Admin Approval", "Reviewed", "Returned for Correction"];

function submissionStage(entry) {
  if (entry.workflowStatus) return entry.workflowStatus;
  const review = entry.staffReviewStatus || "Pending Review";
  if (["Accepted", "Not Required"].includes(review)) return "Completed";
  if (review === "Rejected") return entry.officialStaffReport ? "Returned for Correction" : "Rejected";
  return entry.officialStaffReport ? "Pending Admin Approval" : "Pending Review";
}

export function reportReviewStatus(record) {
  if (!record) return "Not Submitted";
  if (record.reportType !== "parent") return record.workflowStatus || "Pending Review";
  const submissions = reportSubmissions(record);
  if (submissions.length === 0) return "Not Submitted";
  if (record.reviewStatus) return record.reviewStatus;
  const stages = submissions
    .filter((entry) => entry.verificationStatus !== "Invalid" && !entry.correctedBySubmission)
    .map(submissionStage);
  for (const stage of REVIEW_STAGE_ORDER) if (stages.includes(stage)) return stage;
  if (stages.length > 0 && stages.every((stage) => stage === "Rejected")) return "Rejected";
  return stages.includes("Completed") ? "Completed" : "Rejected";
}

export function latestSubmittedAt(record) {
  if (!record) return null;
  if (record.reportType !== "parent") return record.submittedAt || record.createdAt || null;
  const submissions = reportSubmissions(record);
  if (submissions.length === 0) return null;
  return submissions.reduce((latest, entry) => {
    const at = entry.recordedAt || entry.submittedAt;
    return toMillis(at) >= toMillis(latest) ? at : latest;
  }, null) || record.lastSubmittedAt || null;
}

// Timeline built from real submission/review records instead of the parent
// report's creation time (which is when seedlings were released, not submitted).
export function reportHistory(record) {
  if (!record) return [];
  if (record.reportType !== "parent") {
    const items = [{ kind: "submitted", title: "Submitted", at: record.createdAt,
      by: record.submittedByName || record.participantName || "" }];
    if (record.reviewedAt) items.push({ kind: "reviewed", title: "Reviewed", at: record.reviewedAt, by: record.reviewedBy || "" });
    if (record.approvedAt) items.push({ kind: "accepted", title: "Approved", at: record.approvedAt, by: record.approvedBy || "" });
    if (record.rejectedAt) items.push({ kind: "rejected", title: "Rejected", at: record.rejectedAt, by: record.rejectedBy || "" });
    return items;
  }
  const items = [{ kind: "opened", title: "Report opened — seedlings released", at: record.createdAt, by: "" }];
  for (const entry of reportSubmissions(record)) {
    const quantity = Number(entry.quantity || 0);
    items.push({
      kind: "submitted",
      title: `Submitted — ${quantity} × ${entry.species || "seedlings"}`,
      at: entry.recordedAt || entry.submittedAt,
      by: entry.submittedByName || entry.contributorName || "",
      submissionId: entry.id,
    });
    if (entry.reviewedAt && ["Accepted", "Rejected"].includes(entry.staffReviewStatus)) {
      items.push({
        kind: entry.staffReviewStatus === "Rejected" ? "rejected" : "accepted",
        title: entry.staffReviewStatus === "Rejected" ? "Submission rejected" : "Submission accepted",
        at: entry.reviewedAt,
        by: entry.reviewedByName || entry.reviewedBy || "",
        submissionId: entry.id,
      });
    }
  }
  if (items.length === 1) items.push({ kind: "awaiting", title: "Awaiting participant submission", at: null, by: "" });
  return items.sort((a, b) => (a.kind === "awaiting" ? 1 : 0) - (b.kind === "awaiting" ? 1 : 0) ||
    toMillis(a.at) - toMillis(b.at));
}

export function photoAvailabilityMessage(record) {
  if (record?.reportType === "parent" && reportSubmissions(record).length === 0) {
    return {
      title: "No evidence submitted yet",
      text: "No participant planting submission has been saved for this report, so there is no evidence to display.",
    };
  }
  return {
    title: "Photo unavailable",
    text: "This submission has no stored evidence photo. Treat it as missing evidence until it is resubmitted.",
  };
}
