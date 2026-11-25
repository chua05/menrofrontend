import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const PAGES = ["DashboardPage", "EventSchedulePage", "MapVisualizationPage", "MonitoringPage", "MyRequestsPage", "PlantingPage",
  "ReforestationAnalyticsPage", "SeedlingRequestsPage", "SeedlingsPage", "UsersPage"];

for (const page of PAGES) test(`${page} uses the shared KPI card`, () => {
  const source = read(`pages/${page}.jsx`);
  assert.match(source, /import KpiCard, \{ KpiGrid \} from "\.\.\/components\/KpiCard";/);
  assert.match(source, /<KpiGrid /);
  assert.doesNotMatch(source, /function KpiCard\(|-kpi-card|-kpi-icon|myr-summary-card/);
});

test("KPI cards are styled in one place only", () => {
  for (const file of readdirSync(new URL("../src/styles/", import.meta.url)).filter(name => name !== "kpi-cards.css"))
    assert.doesNotMatch(read(`styles/${file}`), /\.(?:[a-z]+-)?kpi-(?:card|grid|icon|title|label|value|note|description)|\.myr-summary-/, file);
  const css = read("styles/kpi-cards.css");
  assert.match(css, /\.kpi-card \{[^}]*align-items: center;[^}]*text-align: center;/s);
});

test("every tone used by a page has a value color", () => {
  const css = read("styles/kpi-cards.css");
  const inJsx = PAGES.flatMap(page => [...read(`pages/${page}.jsx`).matchAll(/<Kpi\w*[^>]*?\stone="(\w+)"/gs)]);
  const inData = ["pages/DashboardPage.jsx", "utils/plantingReportView.js"].flatMap(path => [...read(path).matchAll(/\btone: "(\w+)"/g)]);
  const tones = new Set([...inJsx, ...inData].map(match => match[1]));
  assert.ok(tones.size > 6);
  // "total" is the default color of every value.
  for (const tone of tones) if (tone !== "total") assert.ok(css.includes(`.kpi-tone-${tone} .kpi-card-value`), tone);
});
