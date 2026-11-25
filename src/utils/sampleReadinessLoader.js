// Read-only loader for GET /verified-sample-monitoring/readiness.
// Follows the backend cursor for a bounded number of pages so no cohort is silently omitted. A backend that does
// not send `nextCursor` gets exactly one request, as before. Nothing here decides eligibility: the backend rows
// are kept in the group the backend put them in.
const READINESS_PATH = "/verified-sample-monitoring/readiness";
const CURSOR = /^[^/\s]{1,400}$/;
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

// Admin-verified reports that have no monitoring cohort yet, in the same row shape (`startsFromReport: true`).
const REPORTS_PATH = "/verified-sample-monitoring/verified-reports";
export const verifiedReportsPath = (cursor = "") => (cursor ? `${REPORTS_PATH}?cursor=${encodeURIComponent(cursor)}` : REPORTS_PATH);
export const verifiedReportStartPath = reportId => `${REPORTS_PATH}/${encodeURIComponent(reportId)}/first-visit`;

// Both lists as one answer. `nextCursor` continues readiness and `reportsCursor` continues the report list. Each list
// keeps its own state, so continuing one never hides that the other is incomplete; `reportsFailed` restarts a report
// list that never loaded. A backend without the report list (404) simply offers no such rows.
const REPORT_PAGES = 4;
const NO_REPORTS = Object.freeze({ cohorts: [], eligible: [], notEligible: [], nextCursor: null });
const combine = (base, page, state) => ({ ...mergeReadiness(base, page), ...state, gates: { ...base.gates, ...page.gates },
  partial: state.readinessPartial || state.reportsPartial || state.reportsFailed,
  truncated: Boolean(state.nextCursor || state.reportsCursor) || state.readinessPartial || state.reportsPartial || state.reportsFailed || state.readinessTruncated });
const readinessState = data => ({ nextCursor: data?.nextCursor || null, readinessPartial: data?.partial === true, readinessTruncated: data?.truncated === true && !data?.nextCursor });
const reportsState = data => ({ reportsCursor: data?.nextCursor || null, reportsPartial: data?.partial === true, reportsFailed: false });
const loadReports = async (fetchReports, options) => {
  try { const data = await loadReadiness(fetchReports, { maxPages: REPORT_PAGES, ...options }); return { data, state: reportsState(data) }; }
  catch (error) { return { data: NO_REPORTS, error, state: { reportsCursor: null, reportsPartial: false, reportsFailed: error?.status !== 404 } }; }
};
export async function loadMonitoringChoices(fetchReadiness, fetchReports, options = {}) {
  const [readiness, reports] = await Promise.all([loadReadiness(fetchReadiness, options), loadReports(fetchReports, options)]);
  return combine(readiness, reports.data, { ...readinessState(readiness), ...reports.state });
}
export const hasMoreChoices = data => Boolean(data?.nextCursor || data?.reportsCursor || data?.reportsFailed);
export async function continueMonitoringChoices(current, fetchReadiness, fetchReports, options = {}) {
  const { nextCursor, readinessPartial = false, readinessTruncated = false, reportsCursor = null, reportsPartial = false, reportsFailed = false } = current;
  if (nextCursor) {
    const next = await loadReadiness(fetchReadiness, { ...options, cursor: nextCursor });
    return combine(current, next, { ...readinessState(next), reportsCursor, reportsPartial, reportsFailed });
  }
  const reports = await loadReports(fetchReports, { ...options, ...(reportsCursor ? { cursor: reportsCursor } : {}) });
  if (reports.error && reports.state.reportsFailed) throw reports.error;
  return combine(current, reports.data, { nextCursor: null, readinessPartial, readinessTruncated, ...reports.state });
}

// After a visit is started its cohort is no longer startable; the next readiness answer brings the real reasons.
export function withoutEligibleCohort(data, cohortId) {
  if (!data) return data;
  return { ...data, eligible: rowsOf(data.eligible).filter(row => idOf(row) !== cohortId),
    cohorts: rowsOf(data.cohorts).map(row => (idOf(row) === cohortId ? { ...row, canCreateVisit: false } : row)) };
}
