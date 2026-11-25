// Read-only loader for GET /verified-sample-monitoring/readiness.
// Follows the backend cursor for a bounded number of pages so no cohort is silently omitted. A backend that does
// not send `nextCursor` gets exactly one request, as before. Nothing here decides eligibility: the backend rows
// are kept in the group the backend put them in.
const READINESS_PATH = "/verified-sample-monitoring/readiness";
const CURSOR = /^[A-Za-z0-9_-]{1,200}$/;
const MAX_PAGES = 8;

export const readinessPath = (cursor = "") => (cursor ? `${READINESS_PATH}?cursor=${encodeURIComponent(cursor)}` : READINESS_PATH);

const rowsOf = value => (Array.isArray(value) ? value : []);
const idOf = row => String(row?.cohortId || "");
const unique = rows => rows.filter((row, index) => !idOf(row) || rows.findIndex(other => idOf(other) === idOf(row)) === index);

// Appends a page. Cohorts already listed keep their first position and group.
export function mergeReadiness(previous, next) {
  const seen = new Set(rowsOf(previous.cohorts).map(idOf).filter(Boolean));
  const add = key => unique([...rowsOf(previous[key]), ...rowsOf(next[key]).filter(row => !seen.has(idOf(row)))]);
  return { ...previous, cohorts: add("cohorts"), eligible: add("eligible"), notEligible: add("notEligible"),
    truncated: next.truncated, nextCursor: next.nextCursor, partial: next.partial };
}

/**
 * @param {(cursor: string) => Promise<object>} fetchPage  resolves one readiness page; rejects on failure
 * @param {{ maxPages?: number, cursor?: string }} [options]  `cursor` continues after an earlier result's nextCursor
 */
export async function loadReadiness(fetchPage, { maxPages = MAX_PAGES, cursor = "" } = {}) {
  const requested = new Set();
  let result = null;
  for (let page = 0, next = cursor; page < maxPages; page += 1) {
    requested.add(next);
    let data;
    try { data = await fetchPage(next); }
    catch (error) {
      if (!result) throw error;
      return { ...result, partial: true };
    }
    const cursorProvided = data != null && Object.hasOwn(data, "nextCursor") && data.nextCursor !== null;
    const valid = typeof data?.nextCursor === "string" && CURSOR.test(data.nextCursor);
    const malformed = cursorProvided && !valid;
    const repeated = valid && requested.has(data.nextCursor);
    const nextCursor = valid && !repeated ? data.nextCursor : null;
    const current = { ...data, cohorts: [], eligible: [], notEligible: [] };
    const batch = { ...data, truncated: Boolean(nextCursor) || data?.truncated === true, nextCursor, partial: repeated || malformed };
    result = mergeReadiness(result || current, batch);
    if (!nextCursor) break;
    next = nextCursor;
  }
  return result;
}

// After a visit is started its cohort is no longer startable; the next readiness answer brings the real reasons.
export function withoutEligibleCohort(data, cohortId) {
  if (!data) return data;
  return { ...data, eligible: rowsOf(data.eligible).filter(row => idOf(row) !== cohortId),
    cohorts: rowsOf(data.cohorts).map(row => (idOf(row) === cohortId ? { ...row, canCreateVisit: false } : row)) };
}
