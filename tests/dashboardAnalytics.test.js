// Admin/Staff dashboard figures come from the analytics service (one set of rules); sample and official survival stay apart.
import test from "node:test";
import assert from "node:assert/strict";
import { barangaySurvivalView, managementFigures, monthlyActivityView, survivalCardView } from "../src/utils/dashboardAnalytics.js";

const analytics = {
  summary: { totalSaplingsDistributed: 717, totalTreesPlanted: 210, sampleSurvivalRate: 90, overallSurvivalRate: null, verifiedPlantingReports: 3 },
  permanentSample: { summary: { survivalRate: 90, totalSampleTrees: 10, latestApprovedMonitoringDate: "2026-11-20" } },
  distributionTrend: ["Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026"].map((period, i) => ({ period, count: i * 10 })),
  plantingTrend: ["Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026"].map((period, i) => ({ period, count: i === 5 ? 210 : 0 })),
  survivalTrend: ["Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026"].map((period) => ({ period, rate: period === "Aug 2026" ? 82 : null })),
  barangaySurvival: [
    { barangay: "ZoneVIIIPoblacion", planted: 150, monitored: 0, rate: null, sampleMonitored: 10, sampleRate: 90 },
    { barangay: "Bical", planted: 60, monitored: 40, rate: 75, sampleMonitored: 0, sampleRate: null },
    { barangay: "Zone IV", planted: 5, monitored: 0, rate: null, sampleMonitored: 0, sampleRate: null },
  ],
};

test("KPI figures are the analytics totals, not page-side sums", () => {
  assert.deepEqual(managementFigures(analytics), { totalDistributed: 717, totalPlanted: 210, verifiedReports: 3, sampleSurvivalRate: 90, officialSurvivalRate: null, sampleTrees: 10 });
  assert.deepEqual(managementFigures(null), { totalDistributed: null, totalPlanted: null, verifiedReports: null, sampleSurvivalRate: null, officialSurvivalRate: null, sampleTrees: 0 },
    "unavailable analytics are unknown, never 0");
});

test("survival card: labelled Sample Survival Rate; official full-cohort survival is reported separately", () => {
  assert.deepEqual(survivalCardView(analytics), { label: "Sample Survival Rate", value: "90%", note: "10 sample trees · official full-cohort survival not yet available" });
  assert.equal(survivalCardView({ ...analytics, summary: { ...analytics.summary, overallSurvivalRate: 82.5 } }).note, "10 sample trees · official full-cohort survival 82.5%");
  const none = survivalCardView({ ...analytics, summary: { ...analytics.summary, sampleSurvivalRate: null }, permanentSample: { summary: { survivalRate: null, totalSampleTrees: 0 } } });
  assert.deepEqual([none.value, none.note], ["—", "No Admin-approved sample monitoring yet"], "no fabricated 0%");
  const officialOnly = survivalCardView({ ...analytics, summary: { ...analytics.summary, sampleSurvivalRate: null, overallSurvivalRate: 90 }, permanentSample: { summary: { totalSampleTrees: 0 } } });
  assert.deepEqual([officialOnly.value, officialOnly.note], ["—", "No approved sample monitoring yet · official full-cohort survival 90%"], "official survival is never shown as the sample rate");
  assert.equal(survivalCardView(null).value, "—");
});

test("monthly chart: the last six analytics months, planting by planting month, official survival gaps stay empty", () => {
  const rows = monthlyActivityView(analytics);
  assert.deepEqual(rows.map((row) => row.month), ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
  assert.deepEqual(rows.map((row) => row.planted), [0, 0, 0, 0, 210, 0]);
  assert.deepEqual(rows.map((row) => row.allocated), [10, 20, 30, 40, 50, 60]);
  assert.deepEqual(rows.map((row) => row.survivalRate), [null, 82, null, null, null, null]);
  assert.deepEqual(monthlyActivityView(null), []);
});

test("barangay survival: sample rates when approved sample results exist, official rates otherwise, never invented zeros", () => {
  const sample = barangaySurvivalView(analytics);
  assert.equal(sample.mode, "sample"); assert.equal(sample.centerLabel, "Sample");
  assert.deepEqual(sample.rows.map((row) => [row.barangay, row.rate, row.officialRate]), [["ZoneVIIIPoblacion", 90, null]]);
  assert.equal(sample.center, "90%");
  const official = barangaySurvivalView({ ...analytics, summary: { ...analytics.summary, sampleSurvivalRate: null, overallSurvivalRate: 75 },
    barangaySurvival: analytics.barangaySurvival.map((row) => ({ ...row, sampleRate: null })) });
  assert.deepEqual([official.mode, official.rows.map((row) => row.barangay), official.center], ["official", ["Bical"], "75%"]);
  const empty = barangaySurvivalView({ ...analytics, summary: { ...analytics.summary, sampleSurvivalRate: null }, barangaySurvival: [] });
  assert.deepEqual([empty.mode, empty.rows, empty.center], ["none", [], "—"]);
});
