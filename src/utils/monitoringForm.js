export const CONDITION_SUM_ERROR = "Healthy + Damaged + Dead must equal Total Trees Checked.";
export const EMPTY_MONITORING_EVIDENCE = Object.freeze({
  latitude: "", longitude: "", accuracy: "", locationCapturedAt: "",
});

function wholeNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

export function monitoringPreview(form, verifiedQuantityValue) {
  const verifiedQuantity = wholeNumber(verifiedQuantityValue);
  const totalChecked = wholeNumber(form.totalChecked);
  const healthy = wholeNumber(form.healthy);
  const damaged = wholeNumber(form.damaged);
  const dead = wholeNumber(form.dead);
  const validTotal = verifiedQuantity > 0 && totalChecked > 0 && totalChecked <= verifiedQuantity;
  const validCounts = validTotal && [healthy, damaged, dead].every((value) => value !== null && value >= 0) &&
    healthy + damaged + dead === totalChecked;
  return {
    validTotal, validCounts, verifiedQuantity, totalChecked,
    unassessed: validTotal ? verifiedQuantity - totalChecked : null,
    coverageRate: validTotal ? (totalChecked / verifiedQuantity) * 100 : null,
    survivalRate: validCounts ? ((healthy + damaged) / totalChecked) * 100 : null,
    mortalityRate: validCounts ? (dead / totalChecked) * 100 : null,
    assessmentType: validTotal
      ? totalChecked === verifiedQuantity ? "Full Cohort" : "Partial Observation"
      : null,
  };
}

export function clearSharedCountError(errors, changedField) {
  if (!["totalChecked", "healthy", "damaged", "dead"].includes(changedField) ||
      errors.totalChecked !== CONDITION_SUM_ERROR) return errors;
  const next = { ...errors };
  delete next.totalChecked;
  return next;
}

function timestampMillis(value) {
  if (!value) return 0;
  const date = typeof value?.toDate === "function" ? value.toDate()
    : Number.isFinite(value?._seconds ?? value?.seconds)
      ? new Date(Number(value._seconds ?? value.seconds) * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function businessDate(entry) {
  const value = entry.monitoredDate || entry.monitoringDate || entry.monitoredAt || entry.createdAt;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const millis = timestampMillis(value);
  if (!millis) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(millis));
}

export function monthlySurvivalRates(entries) {
  const selected = new Map();
  [...entries].sort((a, b) => {
    const dateOrder = businessDate(a).localeCompare(businessDate(b));
    return dateOrder || timestampMillis(a.monitoredAt || a.createdAt) -
      timestampMillis(b.monitoredAt || b.createdAt) ||
      Number(a.__historyIndex || 0) - Number(b.__historyIndex || 0);
  }).forEach((entry) => {
    const month = businessDate(entry).slice(0, 7);
    if (month) selected.set(`${entry.lifecycleId}|${month}`, entry);
  });
  const totals = new Map();
  selected.forEach((entry) => {
    if (entry.isFullCohortAssessment === false) return;
    const month = businessDate(entry).slice(0, 7);
    const healthy = Number(entry.healthyCount ?? entry.healthy ?? 0) || 0;
    const damaged = Number(entry.damagedCount ?? entry.damaged ?? 0) || 0;
    const dead = Number(entry.deadCount ?? entry.dead ?? 0) || 0;
    const total = Number(entry.totalMonitored ?? entry.totalChecked) || healthy + damaged + dead;
    const bucket = totals.get(month) || { surviving: 0, total: 0 };
    bucket.surviving += healthy + damaged;
    bucket.total += total;
    totals.set(month, bucket);
  });
  return new Map([...totals].map(([month, bucket]) => [
    month, bucket.total > 0 ? Math.round((bucket.surviving / bucket.total) * 10000) / 100 : null,
  ]));
}

const LEGACY_VALIDATED = new Set(["accepted", "approved", "reviewed", "validated", "verified"]);
const LEGACY_EXCLUDED = new Set(["invalid", "pending", "pending review", "rejected", "returned for rechecking"]);

export function isOfficialMonitoringObservation(entry = {}, lifecycle = {}) {
  if (entry.observationType === "early") return false;
  if (Number(entry.workflowVersion) >= 2) {
    return entry.reviewStatus === "Approved" && entry.adminDecision === "Approve" &&
      Boolean(entry.adminDecidedBy) && Boolean(entry.adminDecidedAt);
  }
  const explicit = String(entry.reviewStatus || entry.staffReviewStatus || entry.verificationStatus || "").trim().toLowerCase();
  if (explicit) return !LEGACY_EXCLUDED.has(explicit) && LEGACY_VALIDATED.has(explicit);
  const inherited = String(lifecycle.reviewStatus || lifecycle.staffReviewStatus || lifecycle.verificationStatus || "").trim().toLowerCase();
  return LEGACY_VALIDATED.has(inherited);
}

export function isFullMonitoringObservation(entry = {}, lifecycle = {}) {
  if (typeof entry.isFullCohortAssessment === "boolean") return entry.isFullCohortAssessment;
  const total = Number(entry.totalMonitored ?? entry.totalChecked) ||
    Number(entry.healthyCount || 0) + Number(entry.damagedCount || 0) + Number(entry.deadCount || 0);
  const cohort = Number(entry.cohortQuantityAtObservation ?? lifecycle.quantityPlanted);
  return total > 0 && cohort > 0 && total === cohort;
}

export function officialMonitoringHistoryEntries(records = []) {
  return records.flatMap((record) => {
    const history = Array.isArray(record?.history) ? record.history : [record];
    return history.filter((entry) => isOfficialMonitoringObservation(entry, record))
      .map((entry, index) => ({
        ...entry,
        barangay: record.barangay,
        siteId: record.siteId,
        lifecycleId: record.id || record.monitoringId || record.plantingReportId,
        isFullCohortAssessment: isFullMonitoringObservation(entry, record),
        __historyIndex: index,
      }));
  });
}

export function weightedOfficialSurvivalRate(records = []) {
  const totals = records.reduce((result, record) => {
    const history = Array.isArray(record?.history) ? record.history : [record];
    const approved = history.filter((entry) => isOfficialMonitoringObservation(entry, record));
    const latest = approved.map((entry, index) => ({ entry, index }))
      .sort((a, b) => businessDate(a.entry).localeCompare(businessDate(b.entry)) ||
        timestampMillis(a.entry.monitoredAt || a.entry.createdAt) - timestampMillis(b.entry.monitoredAt || b.entry.createdAt) ||
        a.index - b.index).at(-1)?.entry;
    if (!latest || !isFullMonitoringObservation(latest, record)) return result;
    const healthy = Number(latest.healthyCount ?? latest.healthy ?? 0) || 0;
    const damaged = Number(latest.damagedCount ?? latest.damaged ?? 0) || 0;
    const dead = Number(latest.deadCount ?? latest.dead ?? 0) || 0;
    const total = Number(latest.totalMonitored ?? latest.totalChecked) || healthy + damaged + dead;
    return { surviving: result.surviving + healthy + damaged, total: result.total + total };
  }, { surviving: 0, total: 0 });
  return totals.total > 0 ? Math.round((totals.surviving / totals.total) * 100) : null;
}

export function monitoringScheduleLabel(record = {}) {
  if (record.nextMonitoringDate) return "";
  if (record.status === "Monitoring Completed") return "No further monitoring required";
  const history = Array.isArray(record.history) ? record.history : [];
  const latest = history.at(-1);
  if (!latest) return "Available after first monitoring submission";
  if (latest.reviewStatus === "Pending Review") return "Pending MENRO Staff review";
  if (latest.reviewStatus === "Reviewed") return "Awaiting Admin decision";
  if (latest.reviewStatus === "Returned for Rechecking") return "Returned for rechecking";
  if (latest.reviewStatus === "Rejected") return "Available for a new observation";
  if (isOfficialMonitoringObservation(latest, record) &&
      !isFullMonitoringObservation(latest, record)) return "No official next date — partial observation";
  return "Next monitoring date not yet scheduled";
}
