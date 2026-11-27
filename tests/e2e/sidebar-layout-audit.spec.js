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
const analytics = {
  summary: { totalSaplingsDistributed: 1234567, totalTreesPlanted: 1200, overallSurvivalRate: 87.5, verifiedPlantingReports: 4, barangaysCovered: 2, activePlantingSites: 1 },
  plantingTrend: [], survivalTrend: [], monitoringConditions: [], speciesDistribution: [], barangaySurvival: [], siteMap: [], verificationAnalytics: {}, accountability: {}, decisionSupport: {}, options: { barangays: [], species: [], sites: [] }, meta: {},
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
    if (el.closest("aside.sidebar, dialog, svg, [aria-hidden='true']")) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || ignored(el)) continue;
    if (box.left < side.right - 1 && box.right > 0) problems.push(`${label(el)} starts at ${Math.round(box.left)} < sidebar edge ${Math.round(side.right)}`);
  }
  for (const el of document.querySelectorAll(".leaflet-container, .recharts-responsive-container")) {
    if (ignored(el)) continue;
    const box = el.getBoundingClientRect(), parent = el.parentElement.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) problems.push(`${label(el)} has no size`);
    if (box.width > parent.width + 1) problems.push(`${label(el)} wider than parent (${Math.round(box.width)} > ${Math.round(parent.width)})`);
  }
  return [...new Set(problems)].slice(0, 8);
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
    for (const width of [1920, 1440, 1280, 1024, 768]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(`${route}${route.includes("?") ? "&" : "?"}role=${role}`);
        const toggle = page.locator(".topbar-menu-btn");
        await expect(toggle).toHaveAccessibleName("Collapse sidebar");
        await settle(page, 248);
        await page.waitForTimeout(300);
        for (const problem of await page.evaluate(audit, 248)) failures.push(`${width} expanded ${route}: ${problem}`);
        await toggle.click();
        await expect(toggle).toHaveAccessibleName("Expand sidebar");
        await settle(page, 72);
        for (const problem of await page.evaluate(audit, 72)) failures.push(`${width} rail ${route}: ${problem}`);
      }
    }
    expect(failures).toEqual([]);
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
