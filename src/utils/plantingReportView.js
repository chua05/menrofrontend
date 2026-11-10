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

// Seedling types and quantities for the table. Parent reports carry the linked
// release allocation (event.seedlingItems) as `allocationSummary`; fall back to
// saved submissions, then to the stored species text, so real data never shows "—".
export function reportSeedlingItems(record) {
  if (!record) return [];
  const merge = (entries) => {
    const bySpecies = new Map();
    for (const { species, quantity } of entries) {
      const name = String(species || "").trim();
      if (!name) continue;
      const current = bySpecies.get(name);
      const amount = Number.isFinite(Number(quantity)) && quantity !== null && quantity !== "" ? Number(quantity) : null;
      bySpecies.set(name, { species: name,
        quantity: !current ? amount
          : current.quantity === null && amount === null ? null : (current.quantity ?? 0) + (amount ?? 0) });
    }
    return [...bySpecies.values()];
  };
  const allocated = merge((Array.isArray(record.allocationSummary) ? record.allocationSummary : [])
    .map((item) => ({ species: item.species, quantity: item.allocated ?? item.quantity })));
  if (allocated.length) return allocated;
  const submitted = merge(reportSubmissions(record)
    .filter((entry) => entry.verificationStatus !== "Invalid")
    .map((entry) => ({ species: entry.species, quantity: entry.quantity })));
  if (submitted.length) return submitted;
  const names = String(record.species || "").split(",").map((name) => name.trim()).filter(Boolean);
  const single = names.length === 1 && record.reportType !== "parent" ? record.quantityPlanted : null;
  return names.map((species) => ({ species, quantity: single ?? null }));
}

// KPI counts come from the same submission/review helpers the table uses, so
// cards and rows always agree.
export const REPORT_KPIS = Object.freeze([
  { key: "total", title: "Total Reports", description: "All planting reports on record", tone: "total" },
  { key: "awaiting", title: "Awaiting Submission", description: "No participant submission yet", tone: "awaiting" },
  { key: "pendingReview", title: "Pending Review", description: "Waiting for Staff review", tone: "review" },
  { key: "pendingApproval", title: "Pending Approval", description: "Waiting for Admin approval", tone: "approval" },
  { key: "returned", title: "Returned for Correction", description: "Sent back for correction", tone: "returned" },
  { key: "completed", title: "Completed", description: "Approved and finalized", tone: "completed" },
]);

export function reportKpiCounts(records) {
  const list = Array.isArray(records) ? records : [];
  const counts = { total: list.length, awaiting: 0, pendingReview: 0, pendingApproval: 0, returned: 0, completed: 0 };
  for (const record of list) {
    if (reportSubmissionStatus(record) !== "Submitted") { counts.awaiting += 1; continue; }
    const review = reportReviewStatus(record);
    if (review === "Pending Review") counts.pendingReview += 1;
    else if (review === "Reviewed" || review === "Pending Admin Approval") counts.pendingApproval += 1;
    else if (review === "Returned for Correction") counts.returned += 1;
    else if (review === "Completed") counts.completed += 1;
  }
  return counts;
}
