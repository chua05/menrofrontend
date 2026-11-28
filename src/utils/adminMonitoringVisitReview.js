// Admin Monitoring Records rows for Staff-submitted permanent-sample visits. Pure helpers so the
// role and filter rules are unit-testable. The visit list is loaded without a server-side status
// filter (that needs a composite Firestore index not deployed for Admin); drafts are dropped here.

import { buildSearchIndex, matchesSearch } from "./recordSearch.js";

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
export function visitMatchesRecordFilters(visit, { search = "", index = null, site = "All", species = "All", condition = "All", from = "", to = "" } = {}) {
  if (species !== "All" || condition !== "All") return false;
  if (site !== "All" && visit.siteName !== site) return false;
  const date = visit.dateMonitored || visit.visitDate || "";
  if (from && date < from) return false;
  if (to && date > to) return false;
  if (!String(search || "").trim()) return true;
  return matchesSearch(index ?? buildSearchIndex(visitSearchFields(visit)), search);
}

// Everything a visit row shows: visit ID, report, site/barangay, visit and monitored dates, status, submitter, progress.
// The submitter and progress texts mirror the row's own wording (MonitoringPage visit table).
export function visitSearchFields(visit) {
  const completed = visit?.progress?.completed ?? 0, total = visit?.progress?.total ?? 0;
  const submitter = visit?.submittedByName === null ? "Submitter unavailable" : `Submitted by ${visit?.submittedByName || "MENRO Staff"}`;
  return [visit?.id, visit?.reportNumber, visit?.siteName, visit?.barangay, visit?.visitDate, visit?.dateMonitored,
    visitStatusLabel(visit?.status), submitter, "Permanent sample visit", "Scheduled visit",
    completed, total, `${completed}/${total} sample trees assessed`];
}

// Reads every page of the authorized visit list. Drafts share the pages with submitted visits, so the
// loop never stops early on a row count: it ends when the cursor ends, repeats, or the runaway guard is
// reached (reported as truncated). Returns null as soon as a newer load has superseded this one.
export async function loadSubmittedVisitPages(fetchPage, { pageSize = 50, maxPages = 200, isCurrent = () => true } = {}) {
  let cursor = "", rows = [], writesPaused = false, labelsIncomplete = false, pages = 0;
  const seen = new Set();
  do {
    const data = (await fetchPage({ cursor, limit: pageSize })) || {};
    if (!isCurrent()) return null;
    rows = rows.concat(submittedVisits(data.visits));
    writesPaused = writesPaused || Boolean(data.writesPaused);
    labelsIncomplete = labelsIncomplete || Boolean(data.labelsIncomplete);
    if (cursor) seen.add(cursor);
    cursor = data.nextCursor || "";
    pages += 1;
  } while (cursor && !seen.has(cursor) && pages < maxPages);
  return { rows, writesPaused, labelsIncomplete, truncated: Boolean(cursor) };
}

// Latest-request-only guard: begin() returns an isCurrent() check that turns false once a newer
// request begins or the owner cancels (unmount), so slower earlier responses are discarded.
export function createLatestRequestGate() {
  let latest = 0;
  return {
    begin() { const request = ++latest; return () => request === latest; },
    cancel() { latest += 1; },
  };
}
