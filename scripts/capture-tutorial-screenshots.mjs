// Captures the screenshots used by the in-app dashboard tutorial (src/components/DashboardTutorial.jsx).
// Uses the isolated mock harness, so no real account or backend is touched.
//
//   1. VITE_MAPTILER_API_KEY=screenshot npx vite --config vite.ui-a11y-test.config.js --host 127.0.0.1 --port 5184 --strictPort
//      (the placeholder key only switches the maps on; this script serves their tiles from OpenStreetMap)
//   2. node scripts/capture-tutorial-screenshots.mjs [participant|staff|admin]
//
// Output: public/tutorial/<role>/<step>.jpg
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ORIGIN = "http://127.0.0.1:5184";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(root, "public", "tutorial");

const barangays = ["San Francisco (Poblacion)", "Sagrada", "Fatima", "Calomagon", "Otavi", "Gate"];
const species = ["Narra", "Mahogany", "Molave", "Bagras", "Kamagong", "Mangium"];
const iso = (day, month = 10) => `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T02:00:00Z`;

const sites = barangays.map((barangay, index) => ({
  id: `s${index}`, name: `${barangay} Upland Reforestation Site`, siteName: `${barangay} Upland Reforestation Site`,
  barangay, areaHectares: 8.5 + index * 2, area: 8.5 + index * 2, status: "Active", capacity: 5000,
  latitude: 12.669 + index * 0.01, longitude: 123.875 + index * 0.012, createdAt: iso(1 + index, 6),
}));
const statuses = ["Pending", "Approved", "Released", "Completed", "Rejected", "Pending"];
const names = ["Bulan National High School Environmental Club", "Sagrada Youth Council", "Juan Dela Cruz", "Fatima Farmers Association", "Maria Santos", "Calomagon Barangay Council"];
const requests = Array.from({ length: 12 }, (_, index) => ({
  id: `r${index}`, userId: "test-participant", requestNumber: `REQ-2026-${101 + index}`, participantName: names[index % names.length],
  fullName: names[index % names.length], requesterName: names[index % names.length], organization: names[index % names.length],
  status: statuses[index % statuses.length], items: [{ inventoryId: `inv${index % 6}`, species: species[index % 6], quantity: 100 + index * 25 }],
  totalQuantity: 100 + index * 25, quantity: 100 + index * 25, species: species[index % 6], barangay: barangays[index % 6],
  purpose: "Community tree planting", proposedDate: `2026-12-${String(5 + index).padStart(2, "0")}`, plantingSiteName: sites[index % 6].name,
  createdAt: iso(10 + index), updatedAt: iso(11 + index),
}));
const reports = Array.from({ length: 10 }, (_, index) => ({
  id: `p${index}`, userId: "test-participant", status: index % 3 === 0 ? "Pending" : "Verified", siteId: `s${index % 6}`, siteName: sites[index % 6].name,
  barangay: barangays[index % 6], species: species[index % 6], quantityPlanted: 250 + index * 40, seedlingsPlanted: 250 + index * 40,
  participantName: names[index % names.length], plantingDate: `2026-${String(5 + (index % 6)).padStart(2, "0")}-1${index % 9}`, createdAt: iso(5 + index, 5 + (index % 6)),
}));
// Spread over the coming weeks so the calendar for the current month has events on it.
const eventDays = [3, 8, 13, 18, 24, 30].map(offset => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10));
const events = Array.from({ length: 6 }, (_, index) => ({
  id: `e${index}`, title: ["Community Tree Planting", "Mangrove Rehabilitation Drive", "School Greening Day", "Upland Reforestation Activity", "Coastal Clean-up and Planting", "Barangay Planting Day"][index],
  eventDate: eventDays[index], date: eventDays[index], startTime: "07:00", endTime: "11:00",
  location: sites[index].name, siteName: sites[index].name, barangay: barangays[index], status: "Upcoming", type: "Tree Planting", capacity: 50, participants: 12 + index * 3,
}));
const monitoring = Array.from({ length: 10 }, (_, index) => ({
  id: `m${index}`, userId: "test-participant", status: "Verified", siteId: `s${index % 6}`, siteName: sites[index % 6].name, barangay: barangays[index % 6],
  species: species[index % 6], aliveCount: 800 + index * 20, deadCount: 60 + index * 5, survivalRate: 82 + (index % 5) * 3,
  monitoringDate: `2026-${String(5 + (index % 6)).padStart(2, "0")}-2${index % 9}`, createdAt: iso(20 + (index % 9), 5 + (index % 6)),
}));
const seedlings = species.map((name, index) => ({
  id: `inv${index}`, species: name, name, commonName: name, scientificName: ["Pterocarpus indicus", "Swietenia macrophylla", "Vitex parviflora", "Eucalyptus deglupta", "Diospyros blancoi", "Acacia mangium"][index],
  quantity: 4200 - index * 550, availableQuantity: 4200 - index * 550, stock: 4200 - index * 550, category: index % 2 ? "Fruit-bearing" : "Forest tree", status: "Available", updatedAt: iso(15 + index),
}));
const users = names.map((name, index) => ({
  id: `u${index}`, uid: `u${index}`, fullName: name, name, email: `user${index + 1}@example.com`, role: index === 0 ? "staff" : "participant",
  userType: index % 2 ? "Individual" : "Organization", barangay: barangays[index], status: "Active", emailVerified: true, createdAt: iso(1 + index, 4),
}));
const responses = {
  "/api/seedling-requests": requests, "/api/seedling-requests/my": requests, "/api/sites": sites,
  "/api/planting-reports": reports, "/api/planting-reports/my-reports": reports, "/api/events": events,
  "/api/monitoring": monitoring, "/api/monitoring/my-records": monitoring, "/api/seedlings": seedlings, "/api/inventory": seedlings,
  "/api/inventory/available": seedlings, "/api/distributions/my-distributions": [],
  "/api/auth/profile": { uid: "test-participant", fullName: "Juan Dela Cruz", email: "juan.delacruz@example.com", contactNumber: "09171234567",
    sector: "Individual", address: "Purok 3, San Francisco (Poblacion), Bulan, Sorsogon", status: "Active", createdAt: iso(1, 4), updatedAt: iso(20) },
  "/api/users": users, "/api/notifications/unread-count": { unreadCount: 2 },
  "/api/notifications": { notifications: [], unreadCount: 2, hasMore: false, nextCursor: null },
};

const STEPS = {
  participant: ["dashboard", "request-seedlings", "my-requests", "event-calendar", "planting-sites", "my-planting-reports", "profile"],
  staff: ["dashboard", "requests", "seedlings", "event-calendar", "planting-sites", "planting-reports", "survival-monitoring", "reforestation-analytics", "map-visualization", "reports"],
  admin: ["dashboard", "requests", "seedlings", "event-calendar", "planting-sites", "planting-reports", "survival-monitoring", "reforestation-analytics", "map-visualization", "reports", "registered-users", "settings"],
};

const boundaries = JSON.parse(fs.readFileSync(path.join(root, "..", "menroBK", "src", "data", "bulan-barangays.json"), "utf8"));
const month = m => `2026-${String(m).padStart(2, "0")}`;
responses["/api/analytics/dashboard"] = {
  summary: { totalSaplingsDistributed: 6850, totalTreesPlanted: 4300, verifiedPlantingReports: 6, barangaysCovered: 6, sampleSurvivalRate: 86.4 },
  distributionTrend: [6, 7, 8, 9, 10, 11].map((m, i) => ({ period: month(m), count: [800, 1250, 950, 1400, 1100, 1350][i] })),
  plantingTrend: [6, 7, 8, 9, 10, 11].map((m, i) => ({ period: month(m), count: [600, 900, 820, 980, 410, 590][i] })),
  survivalTrend: [6, 7, 8, 9, 10, 11].map((m, i) => ({ period: month(m), rate: [91, 89, 88, 87, 86, 86.4][i] })),
  monitoringConditions: [{ condition: "Healthy", count: 412 }, { condition: "Damaged", count: 38 }, { condition: "Dead", count: 27 }],
  speciesDistribution: species.map((name, i) => ({ species: name, planted: [1050, 900, 760, 640, 520, 430][i] })),
  barangaySurvival: barangays.map((name, i) => ({ barangay: name, planted: [1050, 900, 760, 640, 520, 430][i], sampleMonitored: 80 - i * 6, sampleRate: 92 - i * 2 })),
  siteMap: sites.map(site => ({ ...site, treesPlanted: 700 })),
  permanentSample: { summary: { cohortsAwaitingRechecking: 1 }, conditions: [{ condition: "Healthy", count: 412 }, { condition: "Damaged", count: 38 }, { condition: "Dead", count: 27 }], trend: [], trees: [], locationUnavailable: 0 },
  options: { barangays, species, sites: sites.map(site => site.name) }, meta: {},
};
// Map tiles are the only outside requests allowed, so the maps look as they do in production.
responses["/api/purpose-policies"] = { version: 1, effectiveDate: "2026-11-01", updatedBy: "MENRO Admin",
  sampling: { percentage: 10, minimum: 30, firstVisitDelayWeeks: 4, intervalMonths: 12, speciesAllocationProcedure: null, physicalSelectionProcedure: null },
  purposes: ["Community tree planting", "School greening", "Personal / backyard planting"].map(purpose => ({ purpose, reporting: "OPTIONAL", monitoring: "NONE", quantityThreshold: null, organizationCondition: null })) };
responses["/api/distributions"] = []; responses["/api/sites/archived"] = []; responses["/api/reports"] = [];
responses["/api/inventory/species"] = seedlings;
const TILE_HOSTS = /(^|\.)(tile\.openstreetmap\.org|api\.maptiler\.com|basemaps\.cartocdn\.com|server\.arcgisonline\.com)$/;
const unmocked = new Set();
const browser = await chromium.launch();
const only = process.argv[2];
for (const [role, pages] of Object.entries(STEPS)) {
  if (only && only !== role) continue;
  fs.mkdirSync(path.join(outRoot, role), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1 });
  // Keep the first-visit guide closed so it does not cover the dashboard screenshot.
  await context.addInitScript(key => window.localStorage.setItem(key, "1"), `menro-tutorial-seen:${role}:test-${role}`);
  const page = await context.newPage();
  page.on("pageerror", error => console.log(`  [${role}] page error: ${error.message}`));
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    // Without a real MapTiler key, draw the same map tiles from OpenStreetMap.
    const tile = url.hostname === "api.maptiler.com" && url.pathname.match(/\/(\d+)\/(\d+)\/(\d+)(@2x)?\.png$/);
    if (tile) return route.fetch({ url: `https://tile.openstreetmap.org/${tile[1]}/${tile[2]}/${tile[3]}.png` })
      .then(response => route.fulfill({ response })).catch(() => route.abort());
    if (url.origin !== ORIGIN) return TILE_HOSTS.test(url.hostname) && route.request().method() === "GET" ? route.continue() : route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/sites/barangay-boundaries") return route.fulfill({ json: boundaries });
    if (!(url.pathname in responses)) unmocked.add(url.pathname);
    return route.fulfill({ json: { success: true, data: responses[url.pathname] ?? [] } });
  });
  for (const step of pages) {
    await page.goto(`/${role}/${step}?role=${role}`.replace(/^/, ORIGIN));
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outRoot, role, `${step}.jpg`), type: "jpeg", quality: 82 });
    console.log(`captured ${role}/${step}`);
  }
  await context.close();
}
await browser.close();
if (unmocked.size) console.log("unmocked endpoints:", [...unmocked].join(", "));
