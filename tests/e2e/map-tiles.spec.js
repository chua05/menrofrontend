// Basemap at every zoom: with the production MapTiler path enabled (placeholder key, tiles answered locally), zooming to the
// deepest level, or onto grouped tree markers, must never leave a blank gray map.
import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

// 1×1 PNG served for every tile request.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const boundary = { type: "FeatureCollection", features: [{ type: "Feature", properties: { ADM4_EN: "Zone VIII Poblacion" },
  geometry: { type: "Polygon", coordinates: [[[123.86, 12.65], [123.90, 12.65], [123.90, 12.68], [123.86, 12.68], [123.86, 12.65]]] } }] };
const site = { id: "z8", siteId: "SITE-0008", siteName: "Zone 8 Green Site - Testing Site 02", barangay: "Zone VIII Poblacion", status: "active",
  latitude: 12.66625, longitude: 123.88045, coverageRadiusMeters: 40, maximumCapacity: 100, planted: 0, verifiedPlanted: 60 };
const offsets = [[0, 0], [4, -17], [-10, -27], [5, -35], [5.4, -35.3], [11, -22], [10, -22.8], [3, -15], [-1, -23], [9.5, -24]];
const trees = offsets.map(([north, east], i) => ({ treeId: `RPT-2026-030-T${String(i + 1).padStart(3, "0")}`, species: "Kalamansi",
  latitude: 12.6662 + north / 111_320, longitude: 123.8806 + east / 108_650, siteId: "z8", siteName: site.siteName, barangay: site.barangay, reportNumber: "RPT-2026-030",
  condition: i === 9 ? "Dead" : i > 5 ? "Damaged" : "Healthy", visitNumber: 1, dateMonitored: "2026-11-20", heightCentimeters: 30, stemDiameterMillimeters: 6, reviewStatus: "Approved", pendingReview: null }));

async function setup(page, role) {
  const tileZooms = [];
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname === "api.maptiler.com" || url.hostname.endsWith("tile.openstreetmap.org")) {
      const z = Number(url.pathname.split("/").at(url.hostname === "api.maptiler.com" ? -3 : -3)); tileZooms.push({ host: url.hostname, z });
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    }
    if (url.origin !== "http://127.0.0.1:5186" && url.origin !== "http://127.0.0.1:5184") return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    let data = [];
    if (url.pathname === "/api/auth/profile") data = { uid: `test-${role}`, fullName: "Map User", contactNumber: "09123456789", province: "Sorsogon", municipality: "Bulan", barangay: "Bical" };
    else if (url.pathname === "/api/sites/barangay-boundaries") return route.fulfill({ json: boundary });
    else if (url.pathname === "/api/sites") data = [site];
    else if (url.pathname === "/api/analytics/map-trees") data = { trees, pendingTrees: [], locationUnavailable: 0, summary: { approvedTrees: 10, pendingTrees: 0 } };
    else if (url.pathname === "/api/analytics/dashboard") data = { summary: {}, distributionTrend: [], plantingTrend: [], survivalTrend: [], monitoringConditions: [], speciesDistribution: [], barangaySurvival: [],
      siteMap: [{ ...site, planted: 60 }], permanentSample: { summary: {}, conditions: [], trend: [], cohorts: [], trees, locationUnavailable: 0 }, verificationAnalytics: {}, accountability: {}, decisionSupport: {}, options: { barangays: [], species: [], sites: [] }, meta: {} };
    else if (url.pathname === "/api/notifications/unread-count") data = { unreadCount: 0 };
    else if (url.pathname === "/api/purpose-policies") data = { version: 0, purposes: [], sampling: {} };
    return route.fulfill({ json: { success: true, data } });
  });
  return tileZooms;
}

// Tiles drawn for the map's current zoom: loaded, visible images in the active tile level.
const visibleTiles = (page, mapSelector) => page.evaluate((selector) => {
  const map = document.querySelector(selector);
  return [...map.querySelectorAll(".leaflet-tile-pane img.leaflet-tile-loaded")].filter((img) => {
    const level = img.closest(".leaflet-tile-container");
    return level && getComputedStyle(level).visibility !== "hidden" && Number(getComputedStyle(img).opacity) > 0 && img.getBoundingClientRect().width > 0;
  }).length;
}, mapSelector);

async function zoomToMaximum(page, mapSelector) {
  const zoomIn = page.locator(`${mapSelector} .leaflet-control-zoom-in`);
  const atMaximum = async () => (await zoomIn.getAttribute("aria-disabled")) === "true" || /leaflet-disabled/.test(await zoomIn.getAttribute("class"));
  for (let i = 0; i < 25 && !(await atMaximum()); i++) { await zoomIn.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(320); }
  expect(await atMaximum(), "map reached its maximum zoom").toBe(true);
}

for (const width of [1440, 390]) {
  test(`full map keeps the basemap at the deepest zoom over monitored trees (${width}px)`, async ({ page }) => {
    const tileZooms = await setup(page, "staff");
    await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
    await page.goto("/staff/map-visualization?role=staff");
    await expect.poll(() => page.locator(".mv-map .ra-tree-marker").count()).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Zoom to monitored trees" }).click();
    await page.waitForTimeout(600);
    expect(await visibleTiles(page, ".mv-map")).toBeGreaterThan(0);
    // Clicking a grouped marker zooms toward its trees; keep going until the map cannot zoom further.
    for (let i = 0; i < 4; i++) {
      const cluster = page.locator(".mv-map .ra-tree-marker:has(.ra-tree-count)").first();
      if (!(await cluster.count()) || await page.locator(".leaflet-popup-content").count()) break;
      await cluster.click(); await page.waitForTimeout(600);
      expect(await visibleTiles(page, ".mv-map"), "tiles after a cluster click").toBeGreaterThan(0);
    }
    await page.keyboard.press("Escape");
    await zoomToMaximum(page, ".mv-map");
    await expect.poll(() => visibleTiles(page, ".mv-map"), { message: "basemap tiles at maximum zoom" }).toBeGreaterThan(0);
    expect(tileZooms.length).toBeGreaterThan(0);
    expect(Math.max(...tileZooms.map(({ z }) => z)), "never asks for tiles deeper than the source serves").toBeLessThanOrEqual(19);
  });
}

test("analytics map keeps the basemap at the deepest zoom", async ({ page }) => {
  await setup(page, "admin");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/reforestation-analytics?role=admin");
  await expect.poll(() => page.locator(".ra-map .ra-tree-marker").count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Zoom to monitored trees" }).click(); await page.waitForTimeout(600);
  await zoomToMaximum(page, ".ra-map");
  await expect.poll(() => visibleTiles(page, ".ra-map")).toBeGreaterThan(0);
});

// Site Utilization overlays: the coverage area and outline (not the blue site-center marker) take the utilization colour,
// from verified planted ÷ capacity, and change on the next refresh. Tree markers stay clickable above them.
const strokeOf = (page, mapSelector) => page.evaluate((selector) => [...document.querySelectorAll(`${selector} .leaflet-overlay-pane path.leaflet-interactive`)]
  .map((path) => [path.getAttribute("stroke"), path.getAttribute("fill")]), mapSelector);

test("full map colours site overlays by verified utilization, updates them on refresh, and keeps trees clickable", async ({ page }) => {
  await setup(page, "staff");
  let current = { ...site, verifiedPlanted: 60 };
  const others = [{ ...site, id: "nocap", siteName: "No Capacity Site", latitude: 12.6698, longitude: 123.8706, maximumCapacity: 0, verifiedPlanted: 5 },
    { ...site, id: "poly", siteName: "Polygon Site", latitude: 12.6600, longitude: 123.8900, coverageRadiusMeters: null, maximumCapacity: 10, verifiedPlanted: 2,
      polygon: [{ lat: 12.6598, lng: 123.8898 }, { lat: 12.6602, lng: 123.8898 }, { lat: 12.6602, lng: 123.8902 }] }];
  await page.route("**/api/sites", (route) => route.fulfill({ json: { success: true, data: [current, ...others] } }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/staff/map-visualization?role=staff");
  await expect.poll(() => strokeOf(page, ".mv-map")).toEqual(expect.arrayContaining([["#d97706", "#f59e0b"], ["#64748b", "#94a3b8"], ["#2f9847", "#4caf63"]]));
  const centers = await page.evaluate(() => [...document.querySelectorAll(".mv-map .leaflet-overlay-pane path.leaflet-interactive")].filter((path) => path.getAttribute("fill") === "#3186d9").length);
  expect(centers, "every site keeps its blue center marker").toBe(3);

  // Legend: tree icons sit inside Site Monitoring Condition; no separate Permanent Sample Trees section.
  const legend = page.locator(".mv-side-panel .mv-panel-card").first();
  await expect(legend).not.toContainText("Permanent Sample Trees");
  const condition = legend.locator(".mv-legend-section", { hasText: "Site Monitoring Condition" });
  for (const text of ["Healthy", "Damaged (Living)", "Dead", "Needs Rechecking", "Pending Review (submitted, not yet approved)", "Overlapping trees"]) await expect(condition).toContainText(text);
  await expect(condition.locator(".map-tree-key")).toHaveCount(6);
  await expect(legend.locator(".mv-legend-section", { hasText: "Site Utilization" })).toContainText("Capacity not set");

  // Approved planting raises the site to 95%: Refresh Map recolours it red without a reload.
  current = { ...current, verifiedPlanted: 95 };
  await page.getByRole("button", { name: "Refresh Map" }).click();
  await expect.poll(() => strokeOf(page, ".mv-map")).toEqual(expect.arrayContaining([["#d72f2f", "#ef4444"]]));

  // A tree marker inside the coverage area is the element under the pointer and opens its own popup.
  await page.getByRole("button", { name: "Zoom to monitored trees" }).click(); await page.waitForTimeout(600);
  const single = page.locator(".mv-map .ra-tree-marker:not(:has(.ra-tree-count))").first();
  const box = await single.boundingBox();
  const topmost = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest(".ra-tree-marker") !== null, [box.x + box.width / 2, box.y + box.height / 2]);
  expect(topmost, "tree markers are drawn above site overlays").toBe(true);
  await single.click();
  await expect(page.locator(".leaflet-popup-content .ra-tree-popup-item").first()).toContainText("RPT-2026-030-T");
});

test("analytics and Planting Sites maps use the same overlay colours and blue site centers", async ({ page }) => {
  await setup(page, "admin");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/reforestation-analytics?role=admin");
  await expect.poll(() => strokeOf(page, ".ra-map")).toEqual(expect.arrayContaining([["#d97706", "#f59e0b"], ["#ffffff", "#3186d9"]]));
  await expect(page.locator(".ra-map-legend")).not.toContainText("Permanent Sample Trees");
  await expect(page.locator(".ra-map-legend")).toContainText("Site Monitoring Condition");
  await page.goto("/admin/planting-sites?role=admin");
  await expect.poll(() => strokeOf(page, ".ps-map, .leaflet-container")).toEqual(expect.arrayContaining([["#d97706", "#f59e0b"], ["#ffffff", "#3186d9"]]));
});
