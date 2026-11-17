// Admin Monitoring Records rows for Staff-submitted permanent-sample visits. Pure helpers so the
// role and filter rules are unit-testable. The visit list is loaded without a server-side status
// filter (that needs a composite Firestore index not deployed for Admin); drafts are dropped here.

export const VISIT_STATUS_LABELS = Object.freeze({
  RETURNED: "Returned for Correction",
  PENDING_ADMIN_APPROVAL: "Pending Admin Review",
  APPROVED: "Approved",
});

// Staff drafts are not submitted, so they never enter the Admin records table or review queue.
const SUBMITTED_STATUSES = new Set(Object.keys(VISIT_STATUS_LABELS));

export const visitStatusLabel = (status) => VISIT_STATUS_LABELS[status] || String(status || "Unknown");

export function submittedVisits(visits = []) {
  return (Array.isArray(visits) ? visits : []).filter((visit) => visit?.id && SUBMITTED_STATUSES.has(visit.status));
}

// Approve/Return are offered only when the backend marks the visit reviewable now (pending, not paused).
export function canDecideVisit(visit, { writesPaused = false } = {}) {
  return !writesPaused && visit?.status === "PENDING_ADMIN_APPROVAL" && visit?.actions?.review === true;
}

// Applies the existing Monitoring Records filters to a visit row. Visits have no single species or
// latest condition, so a species or condition filter excludes them rather than guessing.
export function visitMatchesRecordFilters(visit, { search = "", site = "All", species = "All", condition = "All", from = "", to = "" } = {}) {
  if (species !== "All" || condition !== "All") return false;
  if (site !== "All" && visit.siteName !== site) return false;
  const date = visit.dateMonitored || visit.visitDate || "";
  if (from && date < from) return false;
  if (to && date > to) return false;
  const term = String(search || "").trim().toLowerCase();
  if (!term) return true;
  return [visit.id, visit.reportNumber, visit.siteName, visit.barangay, visit.submittedByName, visitStatusLabel(visit.status), "permanent sample visit"]
    .filter(Boolean).join(" ").toLowerCase().includes(term);
}
