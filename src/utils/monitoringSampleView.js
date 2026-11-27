// Survival Monitoring (Staff/Admin): the survival KPI, condition summary and trend come from the same Admin-approved
// permanent-sample results the Analytics and Visualization module shows (GET /api/analytics/dashboard → permanentSample).
// Official full-cohort figures are used, and labelled official, only when there are no approved sample results. A missing
// rate is a dash and a month without results is a gap: never 0%.

const known = (value) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
// Written as the Analytics module writes rates (en-PH number format).
const percent = (value) => (known(value) === null ? "—" : `${new Intl.NumberFormat("en-PH").format(Number(value))}%`);
const LOADING = "Loading approved sample monitoring results…";
const share = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

const SAMPLE_CONDITIONS = [
  { condition: "Healthy", label: "Healthy", note: "Good condition" },
  { condition: "Damaged", label: "Damaged (Living)", note: "Surviving, needs attention" },
  { condition: "Dead", label: "Dead", note: "Did not survive" },
  { condition: "Needs Rechecking", label: "Needs Rechecking", note: "Condition not yet confirmed" },
];

// Query string for the analytics service from the page's Site and Species filters.
export function monitoringSampleQuery({ site, species } = {}) {
  const query = new URLSearchParams();
  if (site && site !== "All") query.set("site", site);
  if (species && species !== "All") query.set("species", species);
  return query.toString();
}

function keepRange(rows, trendRange) {
  if (trendRange === "all") return rows;
  return rows.slice(-(trendRange === "12" ? 12 : 6));
}

// sample: analytics permanentSample for the current filters (or null when not loaded); sampleLoading while it loads;
// sampleError when loading it failed; filtered when Site or Species filters are applied; official: { survivalRate, healthy, damaged, dead,
// healthyPercent, damagedPercent, deadPercent, trend:[{month, survivalRate}] } from approved full-cohort records.
export function monitoringSurvivalView({ sample, sampleLoading = false, sampleError = false, filtered = false, official, trendRange = "6" }) {
  if (!sample && sampleLoading) {
    return { mode: "loading", kpi: { title: "Sample Survival Rate", value: "—", description: LOADING }, conditions: [], survivalRate: null,
      survivalLabel: "Sample Survival Rate", trendTitle: "Sample Survival Rate Trend", trendSubtitle: "Permanent sample survival by month monitored (Admin-approved visits)",
      trend: [], emptyMessage: LOADING };
  }
  const sampleTrees = known(sample?.summary?.totalSampleTrees) ?? 0;
  if (sample && sampleTrees > 0) {
    const rate = known(sample.summary.survivalRate);
    const counts = new Map((sample.conditions || []).map((row) => [row.condition, known(row.count) ?? 0]));
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    const officialText = known(official?.survivalRate) === null
      ? "official full-cohort survival not yet available"
      : `official full-cohort survival ${percent(official.survivalRate)}`;
    const parts = [`${sampleTrees} sample ${sampleTrees === 1 ? "tree" : "trees"}`];
    if (rate === null) parts.push("awaiting rechecking results");
    parts.push(officialText);
    return {
      mode: "sample",
      kpi: { title: "Sample Survival Rate", value: percent(rate), description: parts.join(" · ") },
      conditions: SAMPLE_CONDITIONS
        .filter(({ condition }) => condition !== "Needs Rechecking" || (counts.get(condition) || 0) > 0)
        .map(({ condition, label, note }) => ({ condition, label, note, count: counts.get(condition) || 0, percent: share(counts.get(condition) || 0, total) })),
      survivalRate: rate,
      survivalLabel: "Sample Survival Rate",
      trendTitle: "Sample Survival Rate Trend",
      trendSubtitle: "Permanent sample survival by month monitored (Admin-approved visits)",
      emptyMessage: "No complete Admin-approved sample monitoring results for the selected filters.",
      trend: keepRange((sample.trend || []).map((row) => ({ month: row.period, survivalRate: known(row.rate),
        checked: known(row.checked) ?? 0, surviving: known(row.surviving) ?? 0, visits: known(row.visits) ?? 0 })), trendRange),
    };
  }
  const officialRate = known(official?.survivalRate);
  return {
    mode: "official",
    kpi: { title: "Official Survival Rate", value: percent(officialRate),
      description: sample && filtered ? "Admin-approved full cohorts, all sites · no approved sample results for the selected filters"
        : sample ? "Admin-approved full cohorts · no approved sample monitoring yet"
        : sampleError ? "Admin-approved full cohorts · approved sample results unavailable right now" : "Admin-approved full cohorts" },
    conditions: [
      { condition: "Healthy", label: "Healthy", note: "Good condition", count: official?.healthy ?? 0, percent: official?.healthyPercent ?? 0 },
      { condition: "Damaged", label: "Damaged", note: "Needs attention", count: official?.damaged ?? 0, percent: official?.damagedPercent ?? 0 },
      { condition: "Dead", label: "Dead", note: "Did not survive", count: official?.dead ?? 0, percent: official?.deadPercent ?? 0 },
    ],
    survivalRate: officialRate,
    survivalLabel: "Official Survival Rate",
    trendTitle: "Official Survival Trend",
    trendSubtitle: "Official full-cohort survival rate (%) over monitoring periods",
    emptyMessage: "No survival monitoring records have been submitted yet.",
    trend: official?.trend || [],
  };
}
