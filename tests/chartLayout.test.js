import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const monitoring = readFileSync(
  new URL("../src/pages/MonitoringPage.jsx", import.meta.url),
  "utf8",
);
const dashboard = readFileSync(
  new URL("../src/pages/DashboardPage.jsx", import.meta.url),
  "utf8",
);
const analytics = readFileSync(
  new URL("../src/pages/ReforestationAnalyticsPage.jsx", import.meta.url),
  "utf8",
);
const dashboardCss = readFileSync(
  new URL("../src/styles/dashboard-page.css", import.meta.url),
  "utf8",
);

test("survival trend preserves its empty-period axes and separates the message", () => {
  assert.match(monitoring, /grouped\.set\(month, \{ month, alive: 0, total: 0 \}\)/);
  assert.match(monitoring, /<LineChart data=\{trendData\}/);
  assert.match(monitoring, /sm-chart-empty-message/);
  assert.doesNotMatch(monitoring, /sm-chart-zero-message/);
});

test("dashboard charts preserve chart scaffolding and empty-state copy", () => {
  assert.match(dashboard, /<BarChart[\s\S]*data=\{[\s\S]*monthlyActivity/);
  assert.match(dashboard, /!hasActivityData && \(/);
  assert.match(dashboard, /dashboard-chart-zero-message/);
  assert.match(dashboard, /dashboard-chart-zero-copy/);
  assert.match(dashboard, /new ResizeObserver/);
  assert.match(dashboard, /invalidateSize\(\{ pan: false \}\)/);
});

test("administrator dashboard places quick actions in the three-card lower row", () => {
  assert.match(dashboard, /dashboard-bottom-grid[\s\S]*<QuickActionsCard actions=\{quickActions\}/);
  assert.match(dashboardCss, /\.dashboard-bottom-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px, 0\.9fr\)[\s\S]*minmax\(280px, 0\.85fr\)/);
  assert.match(dashboardCss, /@media \(max-width: 1100px\)[\s\S]*\.dashboard-bottom-grid\s*\{\s*grid-template-columns: repeat\(2/);
  assert.match(dashboardCss, /@media \(max-width: 620px\)[\s\S]*\.dashboard-bottom-grid\s*\{\s*grid-template-columns: 1fr/);
});

test("analytics trend charts retain their existing data and chart configuration", () => {
  assert.match(analytics, /<BarChart data=\{analytics\.plantingTrend\}>/);
  assert.match(analytics, /<LineChart data=\{analytics\.survivalTrend\}>/);
  assert.doesNotMatch(analytics, /<ChartEmpty/);
});
