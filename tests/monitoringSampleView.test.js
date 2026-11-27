// Survival Monitoring shows the same Admin-approved permanent-sample figures as Analytics (one backend calculation), and
// falls back to official full-cohort figures only when there are no approved sample results. Nothing is made up.
import test from "node:test";
import assert from "node:assert/strict";
import { monitoringSampleQuery, monitoringSurvivalView } from "../src/utils/monitoringSampleView.js";

const sample = {
  summary: { survivalRate: 90, totalSampleTrees: 10, monitoredCohorts: 1, cohortsAwaitingRechecking: 0, approvedVisits: 1, latestApprovedMonitoringDate: "2026-11-26" },
  conditions: [["Healthy", 6], ["Damaged", 3], ["Dead", 1], ["Needs Rechecking", 0]].map(([condition, count]) => ({ condition, count })),
  trend: ["Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026"].map((period) =>
    ({ period, rate: period === "Nov 2026" ? 90 : null, checked: period === "Nov 2026" ? 10 : 0, surviving: period === "Nov 2026" ? 9 : 0, visits: period === "Nov 2026" ? 1 : 0 })),
};
const official = { survivalRate: 82, healthy: 120, damaged: 12, dead: 18, healthyPercent: 80, damagedPercent: 8, deadPercent: 12,
  trend: [{ month: "Oct 2026", survivalRate: 82 }, { month: "Nov 2026", survivalRate: null }] };

test("approved sample results drive the KPI, conditions, survival row and trend (same figures as Analytics)", () => {
  const view = monitoringSurvivalView({ sample, official, trendRange: "6" });
  assert.equal(view.mode, "sample");
  assert.deepEqual(view.kpi, { title: "Sample Survival Rate", value: "90%", description: "10 sample trees · official full-cohort survival 82%" });
  assert.deepEqual(view.conditions.map(({ label, count, percent }) => [label, count, percent]), [["Healthy", 6, 60], ["Damaged (Living)", 3, 30], ["Dead", 1, 10]]);
  assert.equal(view.survivalRate, 90);
  assert.equal(view.trendTitle, "Sample Survival Rate Trend");
  assert.deepEqual(view.trend.at(-1), { month: "Nov 2026", survivalRate: 90, checked: 10, surviving: 9, visits: 1 });
  assert.equal(view.trend.filter((row) => row.survivalRate === null).length, 5, "months without approved sample results are gaps, not 0%");
});

test("the trend range keeps the latest months of the analytics trend", () => {
  const long = { ...sample, trend: Array.from({ length: 14 }, (_, i) => ({ period: `P${i}`, rate: i === 13 ? 90 : null, checked: 0, surviving: 0, visits: 0 })) };
  assert.equal(monitoringSurvivalView({ sample: long, official, trendRange: "6" }).trend.length, 6);
  assert.equal(monitoringSurvivalView({ sample: long, official, trendRange: "12" }).trend.length, 12);
  assert.equal(monitoringSurvivalView({ sample: long, official, trendRange: "all" }).trend.length, 14);
});

test("Needs Rechecking is listed only when trees need rechecking; a rate awaiting rechecking is a dash, not 0%", () => {
  const awaiting = { ...sample, summary: { ...sample.summary, survivalRate: null, cohortsAwaitingRechecking: 1 },
    conditions: [["Healthy", 6], ["Damaged", 2], ["Dead", 1], ["Needs Rechecking", 1]].map(([condition, count]) => ({ condition, count })) };
  const view = monitoringSurvivalView({ sample: awaiting, official: { ...official, survivalRate: null }, trendRange: "6" });
  assert.equal(view.mode, "sample");
  assert.equal(view.kpi.value, "—");
  assert.equal(view.kpi.description, "10 sample trees · awaiting rechecking results · official full-cohort survival not yet available");
  assert.deepEqual(view.conditions.map((row) => row.label), ["Healthy", "Damaged (Living)", "Dead", "Needs Rechecking"]);
  assert.equal(view.survivalRate, null);
});

test("without approved sample results the page keeps the official full-cohort figures, labelled official", () => {
  const empty = { summary: { survivalRate: null, totalSampleTrees: 0 }, conditions: [], trend: [] };
  const view = monitoringSurvivalView({ sample: empty, official, trendRange: "6" });
  assert.equal(view.mode, "official");
  assert.deepEqual(view.kpi, { title: "Official Survival Rate", value: "82%", description: "Admin-approved full cohorts · no approved sample monitoring yet" });
  assert.deepEqual(view.conditions.map(({ label, count, percent }) => [label, count, percent]), [["Healthy", 120, 80], ["Damaged", 12, 8], ["Dead", 18, 12]]);
  assert.equal(view.trendTitle, "Official Survival Trend");
  assert.deepEqual(view.trend, official.trend);
  // Sample results not loaded (participant, or the service is unavailable): official figures, no sample claim.
  assert.equal(monitoringSurvivalView({ sample: null, official, trendRange: "6" }).kpi.description, "Admin-approved full cohorts");
  assert.equal(monitoringSurvivalView({ sample: null, official: { ...official, survivalRate: null }, trendRange: "6" }).kpi.value, "—");
  assert.equal(monitoringSurvivalView({ sample: null, sampleError: true, official, trendRange: "6" }).kpi.description, "Admin-approved full cohorts · approved sample results unavailable right now");
});

test("the page's site and species filters reach the analytics service", () => {
  assert.equal(monitoringSampleQuery({ site: "All", species: "All" }), "");
  assert.equal(monitoringSampleQuery({ site: "Bical Ridge", species: "Narra" }), "site=Bical+Ridge&species=Narra");
});

test("while approved sample results load, the survival card waits instead of showing official figures under the sample's place", () => {
  const view = monitoringSurvivalView({ sample: null, sampleLoading: true, official, trendRange: "6" });
  assert.equal(view.mode, "loading");
  assert.deepEqual(view.kpi, { title: "Sample Survival Rate", value: "—", description: "Loading approved sample monitoring results…" });
  assert.deepEqual(view.conditions, []);
  assert.deepEqual(view.trend, []);
  assert.equal(view.survivalRate, null);
  assert.equal(view.emptyMessage, "Loading approved sample monitoring results…");
});

test("with Site or Species filters and no matching sample results, the official fallback says it covers all sites", () => {
  const empty = { summary: { survivalRate: null, totalSampleTrees: 0 }, conditions: [], trend: [] };
  const view = monitoringSurvivalView({ sample: empty, filtered: true, official, trendRange: "6" });
  assert.equal(view.mode, "official");
  assert.equal(view.kpi.description, "Admin-approved full cohorts, all sites · no approved sample results for the selected filters");
  assert.equal(monitoringSurvivalView({ sample: empty, official, trendRange: "6" }).emptyMessage, "No survival monitoring records have been submitted yet.");
  assert.equal(monitoringSurvivalView({ sample, official, trendRange: "6" }).emptyMessage, "No complete Admin-approved sample monitoring results for the selected filters.");
});

test("rates are written as the Analytics module writes them", () => {
  const view = monitoringSurvivalView({ sample: { ...sample, summary: { ...sample.summary, survivalRate: 88.889 } }, official, trendRange: "6" });
  assert.equal(view.kpi.value, "88.889%");
});
