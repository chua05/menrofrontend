import { expect, test } from "@playwright/test";

const ORIGIN = "http://127.0.0.1:5184";
const uid = "test-participant";
const barangay = "San Francisco (Poblacion)";
const statuses = ["Pending", "Approved", "Released", "Completed", "Rejected"];
const sites = Array.from({ length: 8 }, (_, index) => ({
  id: `s${index}`, name: `Barangay Sagrada Upland Reforestation Site ${index}`, siteName: `Barangay Sagrada Upland Reforestation Site ${index}`,
  barangay, areaHectares: 12.5 + index, status: "Active", latitude: 12.67, longitude: 123.87, capacity: 5000,
}));
const requests = Array.from({ length: 14 }, (_, index) => ({
  id: `r${index}`, userId: uid, requestNumber: `REQ-2026-${100 + index}`, participantName: "Bulan National High School Environmental Club",
  status: statuses[index % 5], items: [{ inventoryId: "narra", species: "Narra", quantity: 120 + index }], totalQuantity: 120 + index,
  barangay, proposedDate: "2099-12-01", plantingSiteName: sites[0].name, createdAt: `2026-10-${10 + index}T02:00:00Z`,
}));
const reports = Array.from({ length: 10 }, (_, index) => ({
  id: `p${index}`, userId: uid, status: index % 2 ? "Verified" : "Pending", siteId: `s${index % 8}`, siteName: sites[index % 8].name,
  barangay, species: "Narra", quantityPlanted: 1250 + index, seedlingsPlanted: 1250 + index,
  plantingDate: `2026-10-1${index % 9}`, createdAt: `2026-10-1${index % 9}T02:00:00Z`,
}));
const events = Array.from({ length: 6 }, (_, index) => ({
  id: `e${index}`, title: `Community Tree Planting Activity at Barangay Sagrada ${index}`, eventDate: `2099-12-1${index}`,
  location: sites[0].name, status: "Upcoming", type: "Tree Planting",
}));
const monitoring = Array.from({ length: 10 }, (_, index) => ({
  id: `m${index}`, userId: uid, status: "Verified", siteId: `s${index % 8}`, siteName: sites[index % 8].name, barangay,
  aliveCount: 900 + index, deadCount: 100, survivalRate: 87.4, monitoringDate: `2026-10-2${index % 9}`, createdAt: `2026-10-2${index % 9}T02:00:00Z`,
}));
const inventory = Array.from({ length: 8 }, (_, index) => ({
  id: `i${index}`, species: `Species ${index}`, speciesName: `Species ${index}`, quantity: 400 + index, available: 300, status: "In Stock",
}));
const policy = {
  version: 3, updatedBy: "MENRO Admin", effectiveDate: "2026-10-01",
  purposes: ["Reforestation", "School Greening", "Community Gardening"].map(purpose => ({
    purpose, reporting: "REQUIRED", monitoring: "PERMANENT_SAMPLE", quantityThreshold: 500, organizationCondition: null })),
  sampling: { percentage: 10, minimum: 30, firstVisitDelayWeeks: 12, intervalMonths: 6, speciesAllocationProcedure: "", physicalSelectionProcedure: "" },
};
const barangays = ["San Francisco (Poblacion)", "Sagrada", "Cogon", "Zone 1", "Zone 2", "Zone 3"];
const speciesNames = ["Narra", "Mahogany", "Molave", "Bagras", "Kamagong", "Acacia"];
const month = m => `2026-${String(m).padStart(2, "0")}`;
const analytics = {
  summary: { totalSaplingsDistributed: 6850, totalTreesPlanted: 4300, overallSurvivalRate: 87.5, verifiedPlantingReports: 6, barangaysCovered: 6, activePlantingSites: 8, sampleSurvivalRate: 86.4 },
  distributionTrend: [6, 7, 8, 9, 10, 11].map((m, i) => ({ period: month(m), count: [800, 1250, 950, 1400, 1100, 1350][i] })),
  plantingTrend: [6, 7, 8, 9, 10, 11].map((m, i) => ({ period: month(m), count: [600, 900, 820, 980, 410, 590][i] })),
  survivalTrend: [6, 7, 8, 9, 10, 11].map((m, i) => ({ period: month(m), rate: [91, 89, 88, 87, 86, 86.4][i] })),
  monitoringConditions: [{ condition: "Healthy", count: 412 }, { condition: "Damaged", count: 38 }, { condition: "Dead", count: 27 }],
  speciesDistribution: speciesNames.map((name, i) => ({ species: name, planted: [1050, 900, 760, 640, 520, 430][i] })),
  barangaySurvival: barangays.map((name, i) => ({ barangay: name, planted: [1050, 900, 760, 640, 520, 430][i], sampleMonitored: 80 - i * 6, sampleRate: 92 - i * 2 })),
  siteMap: sites.map(site => ({ ...site, treesPlanted: 700 })),
  permanentSample: { summary: { cohortsAwaitingRechecking: 1 }, conditions: [{ condition: "Healthy", count: 412 }, { condition: "Damaged", count: 38 }, { condition: "Dead", count: 27 }], trend: [], trees: [], locationUnavailable: 0 },
  verificationAnalytics: {}, accountability: {}, decisionSupport: {},
  options: { barangays, species: speciesNames, sites: sites.map(site => site.name) }, meta: {},
};
const responses = {
  "/api/analytics/dashboard": analytics,
  "/api/purpose-policies": policy,
  "/api/seedling-requests": requests, "/api/seedling-requests/my": requests, "/api/sites": sites,
  "/api/planting-reports": reports, "/api/planting-reports/my-reports": reports, "/api/events": events,
  "/api/monitoring": monitoring, "/api/monitoring/my-records": monitoring, "/api/inventory": inventory, "/api/seedlings": inventory,
  "/api/notifications/unread-count": { unreadCount: 2 },
  "/api/notifications": { notifications: [], unreadCount: 2, hasMore: false, nextCursor: null },
};

async function mockApi(page) {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/sites/barangay-boundaries") return route.fulfill({ json: { type: "FeatureCollection", features: [] } });
    return route.fulfill({ json: { success: true, data: responses[url.pathname] ?? [] } });
  });
}

// Geometry audit run inside the page; returns readable problem strings.
const audit = (sidebarWidth) => {
  const problems = [];
  const counts = { leaflet: 0, recharts: 0 };
  const label = el => `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`;
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) problems.push(`horizontal scroll: ${doc.scrollWidth} > ${doc.clientWidth}`);
  const side = document.querySelector("#menro-sidebar").getBoundingClientRect();
  if (Math.abs(side.width - sidebarWidth) > 1) problems.push(`sidebar width ${side.width}, expected ${sidebarWidth}`);
  // Zero-area, hidden, clipped and position:fixed elements are not page content.
  const ignored = el => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed") return true;
      if (style.clipPath && style.clipPath !== "none") return true;
    }
    return false;
  };
  // Page content is everything inside the main column; the shell wrappers legitimately span the full viewport.
  for (const el of document.querySelectorAll(".dashboard-main, .dashboard-main *")) {
    if (el.closest("aside.sidebar, dialog, svg, .leaflet-container *, [aria-hidden='true']")) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || ignored(el)) continue;
    if (box.left < side.right - 1 && box.right > 0) problems.push(`${label(el)} starts at ${Math.round(box.left)} < sidebar edge ${Math.round(side.right)}`);
    if (box.width <= 1 && box.height <= 1) continue; // visually hidden text
    // Right edge: content must end inside the viewport unless it sits in a deliberate sideways scroller, and must not be cut off by an overflow:hidden/clip ancestor.
    let scroller = false;
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === "visible") continue;
      if (overflowX === "auto" || overflowX === "scroll") { scroller = true; break; }
      const nodeRight = node.getBoundingClientRect().right;
      if (box.right > nodeRight + 1 && box.left < nodeRight) {
        problems.push(`${label(el)} clipped by ${label(node)} (right ${Math.round(box.right)} > ${Math.round(nodeRight)})`);
        break;
      }
    }
    if (!scroller && box.right > doc.clientWidth + 1) problems.push(`${label(el)} ends at ${Math.round(box.right)} > viewport ${doc.clientWidth}`);
  }
  for (const el of document.querySelectorAll(".leaflet-container, .recharts-responsive-container")) {
    if (ignored(el)) continue;
    counts[el.classList.contains("leaflet-container") ? "leaflet" : "recharts"] += 1;
    const box = el.getBoundingClientRect(), parent = el.parentElement.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) problems.push(`${label(el)} has no size`);
    if (box.width > parent.width + 1) problems.push(`${label(el)} wider than parent (${Math.round(box.width)} > ${Math.round(parent.width)})`);
  }
  return { problems: [...new Set(problems)].slice(0, 8), counts };
};

async function settle(page, sidebarWidth) {
  await expect.poll(() => page.evaluate(width => {
    const side = document.querySelector("#menro-sidebar").getBoundingClientRect();
    const main = document.querySelector(".dashboard-main").getBoundingClientRect();
    return Math.abs(side.width - width) <= 1 && Math.abs(main.left - side.right) <= 1;
  }, sidebarWidth)).toBe(true);
  await page.waitForTimeout(250);
}

test.describe.configure({ mode: "serial" });
test.setTimeout(900000);

for (const role of ["admin", "staff", "participant"]) {
  test(`${role} pages never overlap the docked sidebar or overflow at any width`, async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => { try { localStorage.setItem("menro-sidebar-expanded", "1"); } catch { /* ignore */ } });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${role}/dashboard?role=${role}`);
    await page.locator("aside#menro-sidebar a[href]").first().waitFor();
    const routes = [...new Set(await page.$$eval("aside#menro-sidebar a[href]", links => links.map(a => a.getAttribute("href")).filter(href => href?.startsWith("/"))))];
    expect(routes.length).toBeGreaterThan(5);

    const failures = [];
    const seen = { leaflet: 0, recharts: 0 };
    const run = async (width, state, route, sidebarWidth) => {
      const result = await page.evaluate(audit, sidebarWidth);
      seen.leaflet += result.counts.leaflet; seen.recharts += result.counts.recharts;
      for (const problem of result.problems) failures.push(`${width} ${state} ${route}: ${problem}`);
    };
    for (const width of [1920, 1440, 1280, 1024, 768]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(`${route}${route.includes("?") ? "&" : "?"}role=${role}`);
        const toggle = page.locator(".topbar-menu-btn");
        await expect(toggle).toHaveAccessibleName("Collapse sidebar");
        await settle(page, 248);
        await page.waitForTimeout(300);
        await run(width, "expanded", route, 248);
        await toggle.click();
        await expect(toggle).toHaveAccessibleName("Expand sidebar");
        await settle(page, 72);
        await run(width, "rail", route, 72);
      }
    }
    expect(failures).toEqual([]);
    // The map and chart assertions must not pass vacuously: each role has at least one page with each.
    expect(seen.leaflet, "Leaflet maps were audited").toBeGreaterThan(0);
    expect(seen.recharts, "Recharts charts were audited").toBeGreaterThan(0);
  });
}

test("phone drawer mode keeps content at x=0 with no horizontal scroll", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const failures = [];
  for (const role of ["admin", "staff", "participant"]) {
    await page.goto(`/${role}/dashboard?role=${role}`);
    await page.getByRole("button", { name: "Open sidebar" }).waitFor();
    const routes = [...new Set(await page.$$eval("dialog a[href], aside a[href]", links => links.map(a => a.getAttribute("href")).filter(href => href?.startsWith("/"))))];
    expect(routes.length).toBeGreaterThan(5);
    for (const route of routes) {
      await page.goto(`${route}${route.includes("?") ? "&" : "?"}role=${role}`);
      await page.getByRole("button", { name: "Open sidebar" }).waitFor();
      await page.waitForTimeout(200);
      const result = await page.evaluate(() => ({
        left: document.querySelector(".dashboard-main").getBoundingClientRect().left,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      if (result.left !== 0 || result.over > 1) failures.push(`${role} ${route}: left=${result.left} overflow=${result.over}`);
    }
  }
  expect(failures).toEqual([]);
});
