// Admin/Staff dashboard figures, read from the analytics service (GET /api/analytics/dashboard) so the dashboard and the
// Analytics and Visualization module show the same numbers from the same rules. Permanent-sample survival (Admin-approved
// Monitor Planted Trees visits) and official full-cohort survival stay separate and are labelled as such. A missing value is
// unknown ("—"), never 0 or 0%.

const known = (value) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
const percent = (value) => (known(value) === null ? "—" : `${Number(Number(value).toFixed(2))}%`);

export function managementFigures(analytics) {
  const summary = analytics?.summary || {};
  return {
    totalDistributed: known(summary.totalSaplingsDistributed),
    totalPlanted: known(summary.totalTreesPlanted),
    verifiedReports: known(summary.verifiedPlantingReports),
    sampleSurvivalRate: known(summary.sampleSurvivalRate),
    officialSurvivalRate: known(summary.overallSurvivalRate),
    sampleTrees: known(analytics?.permanentSample?.summary?.totalSampleTrees) ?? 0,
  };
}

export function survivalCardView(analytics) {
  const figures = managementFigures(analytics);
  if (figures.sampleSurvivalRate === null) {
    if (!analytics) return { label: "Sample Survival Rate", value: "—", note: "Monitoring data unavailable" };
    return { label: "Sample Survival Rate", value: "—", note: figures.officialSurvivalRate === null
      ? "No Admin-approved sample monitoring yet"
      : `No approved sample monitoring yet · official full-cohort survival ${percent(figures.officialSurvivalRate)}` };
  }
  const official = figures.officialSurvivalRate === null
    ? "official full-cohort survival not yet available"
    : `official full-cohort survival ${percent(figures.officialSurvivalRate)}`;
  return { label: "Sample Survival Rate", value: percent(figures.sampleSurvivalRate),
    note: `${figures.sampleTrees} sample ${figures.sampleTrees === 1 ? "tree" : "trees"} · ${official}` };
}

// The last six months of the analytics trends. Planting is grouped by planting month and distribution by release month (as in
// Analytics); the survival line is official full-cohort survival, and a month without official observations is a gap.
export function monthlyActivityView(analytics, months = 6) {
  const distribution = analytics?.distributionTrend || [], planting = analytics?.plantingTrend || [], survival = analytics?.survivalTrend || [];
  if (!planting.length && !distribution.length) return [];
  const periods = (planting.length ? planting : distribution).map((row) => row.period).slice(-months);
  const value = (rows, period, field) => rows.find((row) => row.period === period)?.[field];
  return periods.map((period) => ({
    month: String(period).split(" ")[0],
    period,
    allocated: known(value(distribution, period, "count")) ?? 0,
    planted: known(value(planting, period, "count")) ?? 0,
    survivalRate: known(value(survival, period, "rate")),
  }));
}

// Survival by barangay: Admin-approved sample rates when any exist (labelled Sample), otherwise official full-cohort rates.
export function barangaySurvivalView(analytics, limit = 7) {
  const rows = analytics?.barangaySurvival || [];
  const figures = managementFigures(analytics);
  const sampleRows = rows.filter((row) => known(row.sampleRate) !== null);
  if (sampleRows.length) {
    return { mode: "sample", title: "Sample Survival Rate by Barangay", centerLabel: "Sample", center: percent(figures.sampleSurvivalRate),
      rows: sampleRows.map((row) => ({ barangay: row.barangay, rate: known(row.sampleRate), officialRate: known(row.rate), trees: known(row.sampleMonitored) ?? 0 }))
        .sort((a, b) => b.rate - a.rate).slice(0, limit) };
  }
  const officialRows = rows.filter((row) => known(row.rate) !== null);
  if (officialRows.length) {
    return { mode: "official", title: "Official Survival Rate by Barangay", centerLabel: "Official", center: percent(figures.officialSurvivalRate),
      rows: officialRows.map((row) => ({ barangay: row.barangay, rate: known(row.rate), officialRate: known(row.rate), trees: known(row.monitored) ?? 0 }))
        .sort((a, b) => b.rate - a.rate).slice(0, limit) };
  }
  return { mode: "none", title: "Survival Rate by Barangay", centerLabel: "Survival", center: "—", rows: [] };
}
