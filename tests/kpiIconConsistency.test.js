import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const KPI_STYLES = [
  ["dashboard-page.css", [".dashboard-kpi-icon", ".kpi-green", ".kpi-blue", ".kpi-orange", ".kpi-purple"]],
  ["reforestation-analytics.css", [".ra-kpi-icon", ".ra-kpi-green", ".ra-kpi-blue", ".ra-kpi-purple", ".ra-kpi-orange"]],
  ["event-calendar.css", [".ec-kpi-icon", ".ec-kpi-icon.green", ".ec-kpi-icon.blue", ".ec-kpi-icon.orange", ".ec-kpi-icon.red"]],
  ["seedlings.css", [".sd-kpi-icon", ".sd-kpi-icon.green", ".sd-kpi-icon.blue", ".sd-kpi-icon.orange", ".sd-kpi-icon.purple", ".sd-kpi-icon.cyan"]],
  ["seedling-requests.css", [".sr-kpi-icon", ".sr-kpi-icon.green", ".sr-kpi-icon.orange", ".sr-kpi-icon.blue", ".sr-kpi-icon.red", ".sr-kpi-icon.purple"]],
  ["registered-users.css", [".ru-kpi-icon", ".ru-kpi-icon.green", ".ru-kpi-icon.orange", ".ru-kpi-icon.blue", ".ru-kpi-icon.purple", ".ru-kpi-icon.red"]],
  ["survival-monitoring.css", [".sm-kpi-icon", ".sm-kpi-green", ".sm-kpi-orange", ".sm-kpi-red"]],
  ["my-requests.css", [".myr-summary-icon", ".myr-summary-icon-total", ".myr-summary-icon-pending", ".myr-summary-icon-reviewed", ".myr-summary-icon-approved", ".myr-summary-icon-rejected"]],
  ["map-visualization.css", [".mv-kpi-icon"]],
  ["planting-reports.css", [".pr-card-icon"]],
];

for (const [file, selectors] of KPI_STYLES) {
  test(`${file} applies the shared green KPI icon treatment`, () => {
    const css = readFileSync(new URL(`../src/styles/${file}`, import.meta.url), "utf8");
    for (const selector of selectors) {
      const escapedSelector = selector.replaceAll(".", "\\.");
      assert.match(
        css,
        new RegExp(`${escapedSelector}[^{}]*\\{[^}]*background:\\s*#e8f6ed;[^}]*color:\\s*#168a45;`, "s"),
        `${selector} must resolve to the shared KPI green treatment`,
      );
    }
  });
}

test("all KPI icon containers retain circular geometry", () => {
  for (const [file, selectors] of KPI_STYLES) {
    const css = readFileSync(new URL(`../src/styles/${file}`, import.meta.url), "utf8");
    const baseSelector = selectors[0].replaceAll(".", "\\.");
    assert.match(
      css,
      new RegExp(`${baseSelector}\\s*\\{[^}]*border-radius:\\s*50%;`, "s"),
      `${file} must keep its KPI icon container circular`,
    );
  }
});
