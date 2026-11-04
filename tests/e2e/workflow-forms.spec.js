import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

const site = { id: "site-1", siteName: "Fixture site", barangay: "Bical", status: "active", latitude: 12.6598, longitude: 123.918,
  maximumCapacity: 1000, planted: 0, availableCapacity: 1000, utilizationPercentage: 0 };
const polygon = { type: "FeatureCollection", features: [{ type: "Feature", properties: { barangay: "Bical", brgy_name: "Bical", NAME_3: "Bical" },
  geometry: { type: "Polygon", coordinates: [[[123.8, 12.5], [124, 12.5], [124, 12.8], [123.8, 12.8], [123.8, 12.5]]] } }] };
async function setup(page, overrides = {}) {
  const calls = [], unexpected = [], external = [];
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:5184") { external.push(url.origin); return route.abort(); }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const key = `${request.method()} ${url.pathname}`;
    const body = request.headers()["content-type"]?.includes("application/json") ? request.postDataJSON() : null;
    calls.push({ key, body });
    let data;
    if (key in overrides) return overrides[key](route, request);
    const lists = ["/api/notifications", "/api/seedling-requests/my", "/api/seedling-requests/my-requests", "/api/planting-reports/my-reports", "/api/events", "/api/monitoring/my-records", "/api/distributions/my-distributions", "/api/seedling-requests", "/api/planting-reports", "/api/monitoring", "/api/users", "/api/inventory", "/api/distributions"];
    if (url.pathname === "/api/auth/profile") data = { uid: "test-participant", fullName: "Workflow User", contactNumber: "09123456789", province: "Sorsogon", municipality: "Bulan", barangay: "Bical" };
    else if (url.pathname === "/api/sites/barangay-boundaries") return route.fulfill({ json: polygon });
    else if (url.pathname === "/api/sites") data = [site];
    else if (url.pathname === "/api/inventory/available") data = [{ id: "tree-1", species: "Narra", currentQuantity: 100 }];
    else if (url.pathname === "/api/notifications/unread-count") data = { unreadCount: 0 };
    else if (lists.includes(url.pathname)) data = [];
    else if (key === "POST /api/seedling-requests") data = { id: "new-request", requestNumber: "REQ-FIXTURE" };
    else { unexpected.push(key); return route.fulfill({ status: 500, json: { success: false, message: "Unregistered test request" } }); }
    return route.fulfill({ json: { success: true, data } });
  });
  return { calls, check() { expect(unexpected).toEqual([]); expect(external.filter(origin => !/cartocdn|openstreetmap/.test(origin))).toEqual([]); } };
}
async function requester(page) {
  await page.goto("/participant/request-seedlings?role=participant");
  await expect(page.getByRole("heading", { name: "Request Seedlings", exact: true })).toBeVisible();
  await page.getByLabel("Sector *", { exact: true }).selectOption("Resident / Individual");
  await page.getByLabel("Province *", { exact: true }).selectOption("Sorsogon");
  await page.getByLabel("Municipality / City *", { exact: true }).selectOption("Bulan");
  await page.getByLabel("Barangay *", { exact: true }).selectOption("Bical");
  await page.getByLabel("Street / Purok / Sitio *").fill("Fixture street");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Purpose of Request *").selectOption("Backyard / Home Planting");
  await page.locator(".sr-tree-row select").selectOption("tree-1");
  await page.getByPlaceholder("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Preferred Release Date *").fill("2099-01-01");
  await page.getByRole("button", { name: "Next", exact: true }).click();
}

test("request wizard renders all inline errors and focuses the first invalid control without a second scroll", async ({ page }) => {
  const fixture = await setup(page);
  await page.addInitScript(() => {
    const focus = HTMLElement.prototype.focus, scroll = Element.prototype.scrollIntoView;
    window.__validationFocus = []; window.__validationScroll = [];
    HTMLElement.prototype.focus = function(options) { window.__validationFocus.push({ invalid: this.getAttribute("aria-invalid"), preventScroll: options?.preventScroll }); return focus.call(this, options); };
    Element.prototype.scrollIntoView = function(options) { window.__validationScroll.push(options); return scroll.call(this, options); };
  });
  await page.goto("/participant/request-seedlings?role=participant");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const sector = page.getByLabel("Sector *", { exact: true });
  await expect(sector).toHaveAttribute("aria-invalid", "true"); await expect(sector).toBeFocused();
  expect(await page.evaluate(() => window.__validationFocus.filter(entry => entry.invalid === "true"))).toEqual([{ invalid: "true", preventScroll: true }]);
  expect(await page.evaluate(() => window.__validationScroll.filter(entry => entry.behavior === "smooth").length)).toBeLessThanOrEqual(1);
  const described = await sector.getAttribute("aria-describedby"); await expect(page.locator(`[id="${described}"]`)).toContainText("select a sector");
  await expect(page.getByText(/fields? need attention/i)).toHaveCount(0);
  await sector.selectOption("Resident / Individual"); await expect(sector).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Barangay *", { exact: true })).toHaveJSProperty("tagName", "SELECT");
  fixture.check();
});

const releaseOption = { requestId: "released-request", requesterName: "Authoritative requester", participantSector: "Resident / Individual", requestType: "individual", expectedVersion: 3,
  siteId: "site-1", siteName: "Fixture site", eventName: "Approved planting", items: [{ inventoryId: "narra", species: "Narra", quantityReleased: 10, availableQuantity: 8 }] };
async function staffForm(page, overrides = {}) {
  const fixture = await setup(page, { "GET /api/planting-reports/official/options": route => route.fulfill({ json: { success: true, data: { options: [releaseOption], nextCursor: null } } }),
    "POST /api/planting-reports/official": route => route.fulfill({ status: 201, json: { success: true, data: { id: "report-fixture", officialSubmissionIds: ["submission-fixture"] } } }), ...overrides });
  await page.goto("/staff/planting-reports?role=staff");
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  await page.getByRole("combobox", { name: "Released Seedling Distribution *" }).selectOption("released-request");
  return fixture;
}
test("Staff official reporting derives read-only identity/release data and submits partial planted plus leftover quantities", async ({ page }) => {
  const fixture = await staffForm(page);
  await expect(page.getByLabel("Requester Name", { exact: true })).toHaveValue("Authoritative requester");
  await expect(page.getByLabel("Requester Name", { exact: true })).toHaveAttribute("readonly");
  await expect(page.getByLabel("Submitted By", { exact: true })).toHaveValue("MENRO Staff");
  await expect(page.getByLabel("Quantity Released", { exact: true })).toHaveValue("10");
  await page.getByLabel("Quantity Planted *", { exact: true }).fill("9");
  await page.getByLabel("Leftover Seedlings (Not Planted) *", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByLabel("Quantity Planted *", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Quantity Planted *", { exact: true })).toBeFocused();
  await page.getByLabel("Quantity Planted *", { exact: true }).fill("6");
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("dialog", { name: "Submit Official Planting Report" })).toHaveCount(0);
  const request = fixture.calls.find(call => call.key === "POST /api/planting-reports/official");
  expect(request.body.expectedVersion).toBe(3); expect(request.body.items).toEqual([{ inventoryId: "narra", quantityPlanted: 6, leftoverQuantity: 2 }]);
  expect(request.body).not.toHaveProperty("staffName"); expect(request.body).not.toHaveProperty("requesterName"); expect(request.body).not.toHaveProperty("quantityReleased"); fixture.check();
});
test("individual release-based preview excludes leftovers and optional attendance uses the protected multipart endpoint", async ({ page }) => {
  const fixture = await staffForm(page, { "PUT /api/planting-reports/official/submission-fixture/attendance": (route, request) => {
    expect(request.headers()["content-type"]).toMatch(/^multipart\/form-data; boundary=/); expect(request.postDataBuffer().toString()).toContain('name="attendance"');
    return route.fulfill({ json: { success: true, data: { hasAttendance: true } } });
  } });
  await page.getByLabel("Confirmation Basis").selectOption("release-based");
  await page.getByLabel("Leftover Seedlings (Not Planted) *").fill("2");
  await expect(page.getByLabel("Quantity Planted *")).toHaveValue("6"); await expect(page.getByLabel("Quantity Planted *")).toHaveAttribute("readonly");
  await page.getByLabel("Attendance Photo/File (Optional)").setInputFiles({ name: "attendance.pdf", mimeType: "application/pdf", buffer: Buffer.from("test-boundary-file; backend validates actual PDF in separate tests") });
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(fixture.calls.filter(call => call.key === "PUT /api/planting-reports/official/submission-fixture/attendance")).toHaveLength(1); fixture.check();
});
test("stale reportable balance displays a general conflict and never silently changes expectedVersion", async ({ page }) => {
  const fixture = await staffForm(page, { "POST /api/planting-reports/official": route => route.fulfill({ status: 409, json: { success: false, message: "The reportable balance changed." } }) });
  await page.getByLabel("Quantity Planted *").fill("2");
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "balance changed" })).toBeVisible();
  expect(fixture.calls.find(call => call.key === "POST /api/planting-reports/official").body.expectedVersion).toBe(3); fixture.check();
});
test("dashboard preserves successful request metrics while failed report metrics show Unavailable with Retry", async ({ page }) => {
  const fixture = await setup(page, { "GET /api/seedling-requests/my": route => route.fulfill({ json: { success: true, data: [{ id: "request-1", participantId: "test-participant", status: "Pending", quantity: 2 }] } }),
    "GET /api/planting-reports/my-reports": route => route.fulfill({ status: 503, json: { success: false, message: "Internal source unavailable" } }) });
  await page.goto("/participant/dashboard?role=participant");
  await expect(page.getByText("Some dashboard information is temporarily unavailable. Please try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(page.getByText("Unavailable", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/dashboard data source/i)).toHaveCount(0); fixture.check();
});

async function plantingDetails(page, { proposed = false, blankArea = false } = {}) {
  if (proposed) await page.getByRole("radio", { name: "Propose New Planting Site", exact: true }).check();
  await page.getByLabel("Barangay *", { exact: true }).selectOption("Bical");
  if (proposed) {
    await page.getByLabel("Site Name *", { exact: true }).fill("Proposed fixture");
    await page.getByLabel("Specific Location / Address *", { exact: true }).fill("Test site street");
    const map = page.locator(".leaflet-container").first();
    await expect(map.locator(".leaflet-tooltip").filter({ hasText: "Bical" }).first()).toBeVisible();
    const mapBounds = await map.boundingBox();
    await map.click({ position: { x: mapBounds.width / 2, y: mapBounds.height / 2 } });
    await expect(page.getByLabel("Latitude", { exact: true })).not.toHaveValue("");
    await page.getByRole("radio", { name: "No", exact: true }).check();
    await page.getByLabel("What type of land or area is the proposed planting location? *").selectOption("Grassland");
    await page.getByLabel(/Describe the current condition/).fill("Unused grassland");
  } else await page.getByRole("combobox", { name: "Planting Site *", exact: true }).selectOption("site-1");
  if (!blankArea) {
    await page.getByLabel(proposed ? "Planting Area (Hectares) (Optional)" : "Planting Area *", { exact: true }).selectOption("Other / Exact Area");
    await page.getByLabel("Specify Planting Area (Hectares)").fill("0.5");
  }
  await page.getByRole("radio", { name: "Pick-up", exact: true }).check();
  await page.getByLabel("Planned Planting Date *").fill("2099-01-02");
  await page.getByLabel(/Start Time/).fill("08:00");
  await page.getByLabel("Planned Number of Planters *").fill("1");
  await page.getByLabel(/Who will be responsible/).fill("Fixture caretaker");
  await page.getByLabel(/How often do you plan/).selectOption("Weekly");
  await page.getByLabel(/How will you care/).fill("Water and protect trees");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Identification Type *")).toBeVisible();
  await page.getByLabel("Identification Type *").selectOption("national_id");
  await page.getByLabel("ID Number *").fill("1234-5678-9012-3456");
  await page.getByRole("checkbox", { name: /confirm that the information/ }).check();
}

test("corrected exact area submits the authoritative coordinates and selected value", async ({ page }) => {
  const fixture = await setup(page); await requester(page); await plantingDetails(page);
  await page.getByRole("button", { name: "Submit Request", exact: true }).click();
  await expect(page).toHaveURL(/participant\/my-requests/);
  const submission = fixture.calls.find(call => call.key === "POST /api/seedling-requests").body;
  expect(submission.workflow.exactArea).toBe("0.5"); expect(submission.eventProposal.latitude).toBe(site.latitude); expect(submission.eventProposal.longitude).toBe(site.longitude);
  fixture.check();
});

test("backend field validation returns to the right step and focuses its inline control", async ({ page }) => {
  const fixture = await setup(page, { "POST /api/seedling-requests": route => route.fulfill({ status: 400, json: { success: false, message: "Invalid area", fieldErrors: { exactArea: "Choose the exact area shown on the site record." } } }) });
  await requester(page); await plantingDetails(page);
  await page.getByRole("button", { name: "Submit Request", exact: true }).click();
  const field = page.getByLabel("Specify Planting Area (Hectares)"); await expect(field).toBeFocused(); await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").filter({ hasText: "Choose the exact area" })).toBeVisible(); fixture.check();
});

test("proposed site accepts omitted area and preserves the map's selected coordinates", async ({ page }) => {
  const fixture = await setup(page); await requester(page); await plantingDetails(page, { proposed: true, blankArea: true });
  await page.getByRole("button", { name: "Submit Request", exact: true }).click();
  await expect(page).toHaveURL(/participant\/my-requests/);
  const submission = fixture.calls.find(call => call.key === "POST /api/seedling-requests").body;
  expect(submission.workflow.plantingAreaHectares).toBeNull(); expect(submission.workflow.areaChoice).toBe("");
  expect(submission.eventProposal.latitude).toBe(Number(submission.workflow.latitude)); expect(submission.eventProposal.longitude).toBe(Number(submission.workflow.longitude)); fixture.check();
});

test("Other area appears directly beneath its dropdown, validates decimals, and clears on option switches", async ({ page }) => {
  const fixture = await setup(page); await requester(page);
  const area = page.getByLabel("Planting Area *", { exact: true });
  await area.selectOption("Other / Exact Area");
  const exact = page.getByLabel("Specify Planting Area (Hectares)"); await expect(exact).toBeVisible(); await expect(exact).toHaveAttribute("placeholder", "e.g., 0.5");
  const bounds = await area.boundingBox(), exactBounds = await exact.boundingBox(); expect(exactBounds.y).toBeGreaterThan(bounds.y + bounds.height);
  await page.getByRole("button", { name: "Next", exact: true }).click(); await expect(exact).toHaveAttribute("aria-invalid", "true");
  await exact.fill("0"); await page.getByRole("button", { name: "Next", exact: true }).click(); await expect(exact).toHaveAttribute("aria-invalid", "true");
  await exact.fill("0.5"); await expect(exact).not.toHaveAttribute("aria-invalid", "true");
  await area.selectOption("2 hectares"); await expect(exact).toHaveCount(0);
  await area.selectOption("Other / Exact Area"); await expect(exact).toHaveValue(""); fixture.check();
});

test("planting report shows field-specific errors, linked labels and correction instead of a summary toast", async ({ page }) => {
  const fixture = await setup(page);
  await page.goto("/participant/my-planting-reports?role=participant");
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  await page.getByRole("button", { name: /Submit Report|Submit Planting Report/ }).last().click();
  const name = page.locator("#planting-submittedByName"); await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused(); await expect(page.locator("#planting-error-submittedByName")).toBeVisible();
  await name.fill("Fixture participant"); await expect(name).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#planting-error-siteId")).toBeVisible();
  fixture.check();
});
