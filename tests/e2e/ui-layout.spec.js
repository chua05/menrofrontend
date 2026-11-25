// Every signed-in page: no visible page header, one shared KPI card design, and no horizontal overflow.
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
  ["admin", "reforestation-analytics", "Reforestation Analytics", 6, []],
  ["admin", "map-visualization", "Map Visualization", 5, ["Refresh Map", "Clear Filters"]],
  ["admin", "reports", "Reports", 0, []],
  ["admin", "registered-users", "Registered Users", 6, []],
  ["admin", "settings", "System Settings", 0, ["Save Settings"]],
  ["staff", "settings", "System Settings", 0, []],
];
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
  expect(layout.visibleH1).toEqual([]);
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
