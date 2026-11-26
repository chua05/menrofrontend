// Every signed-in page: no visible page header (except the pages listed in VISIBLE_HEADERS), one shared KPI card design, and no horizontal overflow.
import process from "node:process";
import { expect, test } from "@playwright/test";

const site = { id: "site-1", siteName: "Fixture site", barangay: "Bical", status: "active", latitude: 12.6598, longitude: 123.918, areaHectares: 1.5,
  maximumCapacity: 1000, planted: 0, availableCapacity: 1000, utilizationPercentage: 0 };
const polygon = { type: "FeatureCollection", features: [{ type: "Feature", properties: { barangay: "Bical", brgy_name: "Bical", NAME_3: "Bical" },
  geometry: { type: "Polygon", coordinates: [[[123.8, 12.5], [124, 12.5], [124, 12.8], [123.8, 12.8], [123.8, 12.5]]] } }] };

async function setup(page, role) {
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:5184") return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    let data = [];
    if (url.pathname === "/api/auth/profile") data = { uid: `test-${role}`, fullName: "Workflow User", contactNumber: "09123456789", province: "Sorsogon", municipality: "Bulan", barangay: "Bical" };
    else if (url.pathname === "/api/sites/barangay-boundaries") return route.fulfill({ json: polygon });
    else if (url.pathname === "/api/sites") data = [site];
    else if (url.pathname === "/api/inventory/available") data = [{ id: "tree-1", species: "Narra", currentQuantity: 100 }];
    else if (url.pathname === "/api/analytics/dashboard") data = { summary: { totalSaplingsDistributed: 1234567, totalTreesPlanted: 1200, overallSurvivalRate: 87.5, verifiedPlantingReports: 4, barangaysCovered: 2, activePlantingSites: 1 },
      plantingTrend: [], survivalTrend: [], monitoringConditions: [], speciesDistribution: [], barangaySurvival: [], siteMap: [], verificationAnalytics: {}, accountability: {}, decisionSupport: {}, options: { barangays: [], species: [], sites: [] }, meta: {} };
    else if (url.pathname === "/api/purpose-policies") data = { version: 0, purposes: [], sampling: {} };
    else if (url.pathname === "/api/notifications/unread-count") data = { unreadCount: 0 };
    return route.fulfill({ json: { success: true, data } });
  });
}

// [role, path, page title kept for assistive technology, KPI cards, buttons that must stay usable]
const PAGES = [
  ["admin", "dashboard", null, 5, []],
  ["participant", "dashboard", /^Welcome/, 4, []],
  ["staff", "requests", "Seedling Requests", 7, ["Submit Seedling Request"]],
  ["staff", "request-seedlings", "Submit Seedling Request", 0, ["Next"]],
  ["participant", "request-seedlings", "Request Seedlings", 0, ["Next"]],
  ["participant", "my-requests", "My Seedling Requests", 5, ["Request Seedlings"]],
  ["staff", "seedlings", "Seedling Inventory", 6, ["Add Seedling"]],
  ["admin", "seedlings", "Seedling Inventory", 6, []],
  ["admin", "event-calendar", "Event Calendar", 4, ["Add Event"]],
  ["participant", "event-calendar", "Event Calendar", 0, []],
  ["admin", "planting-sites", "Planting Sites Map", 0, ["Refresh Map", "Add Planting Site"]],
  ["staff", "planting-reports", "Planting Reports", 6, ["Submit Planting Report", "Reset"]],
  ["participant", "my-planting-reports", "My Planting Reports", 4, ["Submit Planting Report"]],
  ["staff", "survival-monitoring", "Survival Monitoring", 4, ["Monitor Planted Trees", "Refresh data"]],
  ["admin", "survival-monitoring", "Survival Monitoring", 4, ["Refresh data"]],
  ["admin", "reforestation-analytics", "Analytics and Visualization", 5, ["Reset"]],
  ["admin", "map-visualization", "Map Visualization", 5, ["Refresh Map", "Clear Filters"]],
  ["admin", "reports", "Reports", 0, []],
  ["admin", "registered-users", "Registered Users", 6, []],
  ["admin", "settings", "System Settings", 0, ["Save Settings"]],
  ["staff", "settings", "System Settings", 0, []],
];
// Pages whose design includes a visible title.
const VISIBLE_HEADERS = { "reforestation-analytics": ["Analytics and Visualization"] };
const WIDTHS = [1440, 1024, 768, 390, 320];
const CARD = ["backgroundColor", "borderTopWidth", "borderTopColor", "borderTopStyle", "borderTopLeftRadius", "boxShadow", "minHeight", "paddingTop", "paddingLeft", "textAlign", "alignItems"];
const TITLE = ["fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform", "fontFamily"];
// The Planting Reports card: the design every other page follows.
const REFERENCE = { backgroundColor: "rgb(255, 255, 255)", borderTopWidth: "1px", borderTopColor: "rgb(228, 233, 230)", borderTopStyle: "solid", borderTopLeftRadius: "10px", textAlign: "center", alignItems: "center" };

for (const [role, path, title, cards, buttons] of PAGES) for (const width of WIDTHS) test(`${role} ${path} at ${width}px`, async ({ page }) => {
  await setup(page, role);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/${role}/${path}?role=${role}`);
  await page.addStyleTag({ content: ".route-transition { animation: none !important; }" });
  await expect(page.locator(".page-loading-state, .dashboard-loading")).toHaveCount(0, { timeout: 20_000 });
  if (process.env.UI_SHOTS) { await page.waitForTimeout(1500); await page.screenshot({ path: `${process.env.UI_SHOTS}/${role}-${path}-${width}.png`, fullPage: true, animations: "disabled" }); }
  await expect(page.locator(".kpi-card")).toHaveCount(cards, { timeout: 20_000 });
  if (title) await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeAttached();
  for (const name of buttons) await expect(page.getByRole("button", { name, exact: true }).first()).toBeVisible();
  const layout = await page.evaluate(([CARD, TITLE]) => {
    const pick = (node, keys) => Object.fromEntries(keys.map(key => [key, getComputedStyle(node)[key]]));
    const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right }; };
    const main = document.querySelector(".dashboard-page-content"), padding = getComputedStyle(main), area = main.getBoundingClientRect();
    const all = [...document.querySelectorAll(".kpi-card")];
    // Anything a person sees: bordered boxes, controls and text (not wrappers, not assistive-only text).
    const seen = [...main.querySelectorAll("*")].filter(node => {
      const r = node.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2 || node.closest(".page-title-hidden, .ps-map-frame")) return false;
      return getComputedStyle(node).borderTopWidth !== "0px" || [...node.childNodes].some(child => child.nodeType === 3 && child.textContent.trim());
    });
    return {
      scroll: document.documentElement.scrollWidth, inner: window.innerWidth,
      visibleH1: [...main.querySelectorAll("h1")].filter(node => node.getBoundingClientRect().width > 2).map(node => node.textContent),
      top: Math.min(...seen.map(node => node.getBoundingClientRect().top)) - area.top - parseFloat(padding.paddingTop),
      left: Math.min(...seen.map(node => node.getBoundingClientRect().left)) - area.left - parseFloat(padding.paddingLeft),
      leftmost: seen.reduce((a, b) => b.getBoundingClientRect().left < a.getBoundingClientRect().left ? b : a).outerHTML.slice(0, 120),
      grid: all.length ? box(document.querySelector(".kpi-grid")) : null,
      boxes: all.map(box), clipped: all.filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.textContent),
      cards: all.map(node => pick(node, CARD)), titles: all.map(node => pick(node.querySelector(".kpi-card-title"), TITLE)),
      offCentre: all.filter(node => [...node.children].some(child => {
        const range = document.createRange(); range.selectNodeContents(child);
        const c = range.getBoundingClientRect(), r = node.getBoundingClientRect();
        return Math.abs((c.left + c.right) / 2 - (r.left + r.right) / 2) > 1.5;
      })).length,
    };
  }, [CARD, TITLE]);
  expect(layout.scroll, "horizontal overflow").toBeLessThanOrEqual(layout.inner);
  expect(layout.visibleH1).toEqual(VISIBLE_HEADERS[path] || []);
  expect(layout.top, "blank space above the first element").toBeLessThanOrEqual(2);
  // Every page starts at the same left edge.
  expect(Math.abs(layout.left), `left edge (${layout.leftmost})`).toBeLessThanOrEqual(2);
  if (!cards) return;
  if (role === "admin" && path === "dashboard") {
    const filter = await page.locator("#dashboard-barangay-filter").boundingBox(), first = layout.boxes[0];
    expect(Math.abs(filter.x - first.x)).toBeLessThan(1.5);
    expect(Math.abs(filter.width - (width <= 620 ? layout.grid.w : first.w))).toBeLessThan(1.5);
  }
  expect(layout.clipped).toEqual([]);
  expect(layout.offCentre).toBe(0);
  for (const style of layout.cards) { expect(style).toMatchObject(REFERENCE); expect(style).toEqual(layout.cards[0]); }
  expect(layout.cards[0].minHeight).toBe(width <= 640 ? "96px" : "112px");
  for (const style of layout.titles) expect(style).toMatchObject({ fontSize: "11px", fontWeight: "700", textTransform: "uppercase" });
  // Same size, equal gaps, rows centred in the grid, nothing overlapping.
  const { boxes, grid } = layout, gap = width <= 640 ? 10 : 14;
  expect(Math.max(...boxes.map(b => b.w)) - Math.min(...boxes.map(b => b.w))).toBeLessThan(1);
  const rows = [...Map.groupBy(boxes, b => Math.round(b.y)).values()];
  for (const row of rows) {
    expect(new Set(row.map(b => Math.round(b.h))).size).toBe(1);
    for (let i = 1; i < row.length; i++) expect(Math.abs(row[i].x - row[i - 1].right - gap)).toBeLessThan(1.5);
    expect(Math.abs((row[0].x - grid.x) - (grid.x + grid.w - row.at(-1).right)), "row is centred").toBeLessThan(2);
  }
  expect(Math.abs(rows[0].at(-1).right - (grid.x + grid.w)), "first row fills the grid").toBeLessThan(2);
});

// Analytics and Visualization: order, filters sent to the backend, honest empty states and layout at every width.
const analyticsData = (filtered) => ({ summary: { totalSaplingsDistributed: filtered ? 150 : 717, totalTreesPlanted: filtered ? 150 : 210, overallSurvivalRate: filtered ? null : 82.5, verifiedPlantingReports: 3, barangaysCovered: 2, activePlantingSites: 2 },
  distributionTrend: ["Jun 2026", "Jul 2026", "Nov 2026"].map((period, i) => ({ period, count: [0, 500, 217][i] })),
  plantingTrend: ["Jun 2026", "Jul 2026", "Nov 2026"].map((period, i) => ({ period, count: [0, 0, filtered ? 0 : 210][i] })),
  survivalTrend: [{ period: "Jul 2026", rate: 90, checked: 100, surviving: 90 }, { period: "Aug 2026", rate: null, checked: 0, surviving: 0 }, { period: "Sep 2026", rate: 82, checked: 50, surviving: 41 }].map(row => filtered ? { ...row, rate: null } : row),
  monitoringConditions: [["Healthy", 120], ["Damaged", 12], ["Dead", 18]].map(([condition, count]) => ({ condition, count: filtered ? 0 : count })),
  speciesDistribution: [{ species: "Pili", planted: 110 }, { species: "Kalamansi", planted: 100 }, { species: "A very long seedling tree name that must wrap inside its card", planted: 0 }],
  barangaySurvival: [{ barangay: "ZoneVIIIPoblacion", planted: 150, monitored: 150, rate: 82 }, { barangay: "ZoneIVPoblacion", planted: 60, monitored: 0, rate: null }],
  siteMap: [{ id: "s1", siteName: "Site 1", barangay: "Bical", latitude: 12.66, longitude: 123.9, planted: 1, maximumCapacity: 10 }],
  // The one approved production visit, as the backend reports it (RPT-2026-030, Visit 1: 6 healthy, 3 damaged, 1 dead).
  permanentSample: filtered ? { summary: { survivalRate: null, totalSampleTrees: 0, monitoredCohorts: 0, cohortsAwaitingRechecking: 0, approvedVisits: 0, latestApprovedMonitoringDate: null },
    conditions: ["Healthy", "Damaged", "Dead", "Needs Rechecking"].map(condition => ({ condition, count: 0 })), trend: [], cohorts: [], exclusions: {} }
    : { summary: { survivalRate: 90, totalSampleTrees: 10, monitoredCohorts: 1, cohortsAwaitingRechecking: 0, approvedVisits: 1, latestApprovedMonitoringDate: "2026-11-26" },
      conditions: [["Healthy", 6], ["Damaged", 3], ["Dead", 1], ["Needs Rechecking", 0]].map(([condition, count]) => ({ condition, count })),
      trend: [{ period: "Oct 2026", rate: null, checked: 0, surviving: 0, visits: 0 }, { period: "Nov 2026", rate: 90, checked: 10, surviving: 9, visits: 1 }],
      cohorts: [{ cohortId: "c1", reportNumber: "RPT-2026-030", siteName: "Zone 8 Green Site", barangay: "ZoneVIIIPoblacion", visitNumber: 1, date: "2026-11-26", total: 10, Healthy: 6, Damaged: 3, Dead: 1, "Needs Rechecking": 0, survivalRate: 90 }], exclusions: {} },
  verificationAnalytics: {}, accountability: {}, decisionSupport: { pendingPlantingReports: 4 },
  options: { barangays: ["Bical", "ZoneVIIIPoblacion"], species: ["Kalamansi", "Pili"], sites: [{ value: "s1", label: "Site 1" }] }, meta: { generatedAt: "2026-11-26T01:00:00Z" } });
for (const width of [1440, 1024, 768, 375]) test(`analytics and visualization at ${width}px`, async ({ page }, info) => {
  await setup(page, "admin");
  const queries = [];
  await page.route("**/api/analytics/dashboard*", route => { const query = new URL(route.request().url()).searchParams; queries.push(query.toString()); return route.fulfill({ json: { success: true, data: analyticsData(query.has("barangay")) } }); });
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/admin/reforestation-analytics?role=admin");
  const top = async selector => (await page.locator(selector).first().boundingBox()).y;
  await expect(page.getByRole("heading", { level: 1, name: "Analytics and Visualization" })).toBeVisible();
  await expect(page.getByText("Reforestation statistics, charts, and trends")).toBeVisible();
  expect(await top(".kpi-grid")).toBeLessThan(await top(".ra-filter-card"));
  expect(await top(".ra-filter-card")).toBeLessThan(await top(".ra-chart-grid-top"));
  await expect(page.locator(".kpi-card-title")).toHaveText(["Total Seedlings Distributed", "Verified Trees Planted", "Overall Survival Rate", "Verified Planting Reports", "Barangays Covered"]);
  await expect(page.locator(".ra-chart-grid-top h2")).toHaveText(["Monthly Seedling Distribution", "Monthly Verified Trees Planted", "Survival Rate Trend"]);
  await expect(page.locator(".ra-detail-grid h2")).toHaveText(["Monitoring Condition Summary", "Verified Trees Planted by Species", "Planting Coverage by Barangay", "Planting Sites Map"]);
  await expect(page.getByText(/Decision Support|Seedling Accountability|Planting Verification Analytics/)).toHaveCount(0);
  const sample = page.getByRole("region", { name: "Permanent Sample Monitoring Analytics" });
  expect(await top(".ra-detail-grid")).toBeLessThan(await top(".ra-ps-section"));
  await expect(sample.locator(".ra-ps-tile strong")).toHaveText(["90%", "10", "1", "2026-11-26"]);
  await expect(sample.locator(".ra-legend-row strong")).toHaveText(["6 · 60%", "3 · 30%", "1 · 10%", "0 · 0%"]);
  await expect(sample.locator("tbody tr")).toHaveCount(1); await expect(sample.locator("tbody tr")).toContainText("RPT-2026-030");
  await expect(page.locator(".ra-chart-grid-top .recharts-surface")).toHaveCount(3);
  await expect(page.locator(".ra-detail-grid tbody tr")).toHaveCount(5);
  await expect(page.locator(".ra-detail-grid tbody tr").filter({ hasText: "ZoneIVPoblacion" })).toContainText("—");
  // Layout: no page overflow, equal cards in each row, charts and the map inside their cards.
  const layout = await page.evaluate(() => {
    const boxes = selector => [...document.querySelectorAll(selector)].map(node => node.getBoundingClientRect());
    const rows = list => Object.values(Object.groupBy(list, r => Math.round(r.top))).map(row => row.map(r => Math.round(r.height)));
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, kpiRows: rows(boxes(".kpi-card")), chartRows: rows(boxes(".ra-chart-grid-top > *")),
      spill: [...document.querySelectorAll(".ra-chart-card, .ra-map-card, .ra-ps-tile")].filter(card => card.scrollWidth > card.clientWidth + 1).length,
      hiddenCells: [...document.querySelectorAll(".ra-detail-grid td, .ra-detail-grid th, .ra-ps-grid td, .ra-ps-grid th")].filter(cell => { const r = cell.getBoundingClientRect(), wrap = cell.closest(".ra-table-wrap").getBoundingClientRect(); return r.right > wrap.right + 1 || r.width < 20; }).map(cell => `${cell.textContent}:${Math.round(cell.getBoundingClientRect().width)}:${Math.round(cell.getBoundingClientRect().right - cell.closest(".ra-table-wrap").getBoundingClientRect().right)}`),
      mapInside: (() => { const map = document.querySelector(".ra-map").getBoundingClientRect(), card = document.querySelector(".ra-map-card").getBoundingClientRect(); return map.left >= card.left - 1 && map.right <= card.right + 1; })() };
  });
  expect(layout.overflow).toBeLessThanOrEqual(0);
  for (const row of [...layout.kpiRows, ...layout.chartRows]) expect(new Set(row).size, JSON.stringify(row)).toBe(1);
  expect(layout.spill).toBe(0); expect(layout.mapInside).toBe(true); if (width > 375) expect(layout.hiddenCells, "every table column is visible without scrolling").toEqual([]);
  await page.screenshot({ path: info.outputPath(`analytics-${width}.png`), fullPage: true });
  if (width !== 1440) return;
  // Filters reach the backend; empty results say so instead of drawing zeros; Reset restores the defaults.
  await page.locator("#ra-barangay").selectOption("Bical");
  await expect.poll(() => queries.at(-1)).toBe("barangay=Bical");
  await expect(page.getByText("No verified planting records available for the selected filters.")).toBeVisible();
  await expect(page.getByText("No official survival monitoring data available yet.")).toBeVisible();
  await expect(page.locator(".kpi-card").nth(2)).toContainText("—"); await expect(page.locator(".kpi-card").nth(2)).toContainText("No official monitoring data yet");
  await expect(page.locator(".ra-detail-grid .ra-legend-row strong")).toHaveText(["—", "—", "—"]);
  await expect(page.getByRole("region", { name: "Permanent Sample Monitoring Analytics" }).locator(".ra-ps-tile strong").first()).toHaveText("—");
  await expect(page.getByText("No approved sample monitoring visits for the selected filters.").first()).toBeVisible();
  await page.locator('input[aria-label="From date"]').fill("2026-12-01"); await page.locator('input[aria-label="To date"]').fill("2026-11-01");
  await expect(page.getByText("The From date cannot be later than the To date.")).toBeVisible();
  const sent = queries.length; await page.waitForTimeout(300); expect(queries.length).toBe(sent);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect.poll(() => queries.at(-1)).toBe(""); await expect(page.locator("#ra-barangay")).toHaveValue("All");
});
