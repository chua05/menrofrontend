import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

const site = { id: "site-1", siteName: "Fixture site", barangay: "Bical", status: "active", latitude: 12.6598, longitude: 123.918, areaHectares: 1.5,
  maximumCapacity: 1000, planted: 0, availableCapacity: 1000, utilizationPercentage: 0 };
const availableSeedling = { id: "tree-1", species: "Narra", currentQuantity: 100 };
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
    else if (url.pathname === "/api/inventory/available") data = [availableSeedling];
    else if (url.pathname === "/api/notifications/unread-count") data = { unreadCount: 0 };
    // The Staff/Admin dashboard reads its figures from the analytics service: an empty, valid payload.
    else if (key === "GET /api/analytics/dashboard") data = { summary: {}, distributionTrend: [], plantingTrend: [], survivalTrend: [], barangaySurvival: [], permanentSample: { summary: { survivalRate: null, totalSampleTrees: 0 }, conditions: [], trend: [] } };
    else if (lists.includes(url.pathname)) data = [];
    else if (key.startsWith("GET ") && /^\/api\/planting-reports\/[^/]+\/verification-logs$/.test(url.pathname)) data = [];
    else if (key === "GET /api/events/event-1/attendance" || key === "GET /api/events/event-1/reservations") data = [];
    else if (key === "POST /api/seedling-requests") data = { id: "new-request", requestNumber: "REQ-FIXTURE" };
    else { unexpected.push(key); return route.fulfill({ status: 500, json: { success: false, message: "Unregistered test request" } }); }
    return route.fulfill({ json: { success: true, data } });
  });
  return { calls, check() { expect(unexpected).toEqual([]); expect(external.filter(origin => !/cartocdn|openstreetmap/.test(origin))).toEqual([]); } };
}
async function requester(page, { role = "participant", navigate = true, heading = "Request Seedlings", sector = "Resident / Individual", detail, purpose = "Household / Backyard" } = {}) {
  if (navigate) await page.goto(`/${role}/request-seedlings?role=${role}`);
  await expect(page.getByRole("heading", { name: role === "staff" ? "Submit Seedling Request" : heading, exact: true })).toBeVisible();
  await page.getByLabel("Requesting As *", { exact: true }).selectOption(sector);
  if (detail) await page.getByLabel(detail.label, { exact: true }).fill(detail.value);
  await page.getByLabel("Province *", { exact: true }).selectOption("Sorsogon");
  await page.getByLabel("Municipality / City *", { exact: true }).selectOption("Bulan");
  await page.getByLabel("Barangay *", { exact: true }).selectOption("Bical");
  await page.getByLabel("Street / Purok / Sitio *").fill("Fixture street");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Purpose of Request *").selectOption(purpose);
  const seedlingSelect = page.locator(".sr-tree-row select");
  const seededOption = seedlingSelect.locator("option").filter({
    hasText: new RegExp(`^${availableSeedling.species}.*${availableSeedling.currentQuantity.toLocaleString("en-US")} available$`),
  });
  await expect(seededOption).toHaveCount(1);
  const groupedValue = await seededOption.getAttribute("value");
  expect(groupedValue).toBeTruthy();
  await seedlingSelect.selectOption(groupedValue);
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
  const sector = page.getByLabel("Requesting As *", { exact: true });
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
  siteId: "site-1", siteName: "Fixture site", eventId: "event-1", latitude: site.latitude, longitude: site.longitude, coverageRadiusMeters: 50,
  barangay: "Bical", plantingDate: "2026-11-05", eventName: "Approved planting", items: [{ inventoryId: "narra", species: "Narra", quantityReleased: 10, availableQuantity: 8 }] };
async function staffForm(page, overrides = {}) {
  const fixture = await setup(page, { "GET /api/planting-reports/official/options": route => route.fulfill({ json: { success: true, data: { options: [releaseOption], nextCursor: null } } }),
    "POST /api/evidence-capture-sessions": (route, request) => {
      expect(request.postDataJSON()).toEqual({ workflow: "planting-report", siteId: "site-1", eventId: "event-1", distributionId: "released-request" });
      return route.fulfill({ json: { success: true, data: { captureSessionId: "mock-session", nonce: "mock-nonce" } } });
    },
    "POST /api/evidence-capture-sessions/mock-session/verify": route => route.fulfill({ json: { success: true, data: { verificationId: "mock-verification", imageSha256: "mock-digest", location: { latitude: site.latitude, longitude: site.longitude } } } }),
    "PUT /api/planting-reports/official/submission-fixture/photos": (route, request) => {
      expect(request.headers()["content-type"]).toMatch(/^multipart\/form-data; boundary=/);
      const multipart = request.postDataBuffer().toString();
      expect(multipart).toContain('name="photos"'); expect(multipart).toContain('name="expectedRevision"\r\n\r\n0');
      expect(multipart).toContain('"captureSessionId":"mock-session"'); expect(request.headers()["idempotency-key"]).toBeTruthy();
      return route.fulfill({ json: { success: true, data: { hasEvidence: true, evidenceVerified: true, evidenceSubmissionId: "submission-fixture" } } });
    },
    "POST /api/planting-reports/official": route => route.fulfill({ status: 201, json: { success: true, data: { id: "report-fixture", officialSubmissionIds: ["submission-fixture"] } } }), ...overrides });
  await page.goto("/staff/planting-reports?role=staff");
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  await page.getByRole("combobox", { name: "Seedling Release Record *" }).selectOption("released-request");
  return fixture;
}
test("Staff official reporting derives read-only identity/release data and submits partial planted plus leftover quantities", async ({ page }) => {
  const fixture = await staffForm(page);
  await expect(page.getByLabel("Requester Full Name", { exact: true })).toHaveValue("Authoritative requester");
  await expect(page.getByLabel("Requester Full Name", { exact: true })).toHaveAttribute("readonly");
  await expect(page.getByLabel("Submitted By", { exact: true })).toHaveValue("MENRO Staff");
  await expect(page.getByLabel("Quantity Released", { exact: true })).toHaveValue("10");
  const planted = page.getByLabel("Quantity Planted *", { exact: true }), leftover = page.getByLabel("Final Leftover Seedlings (Not Planted)", { exact: true });
  await expect(leftover).toHaveValue("0"); await expect(planted).toHaveValue("8"); await expect(planted).toHaveAttribute("readonly");
  await leftover.fill("9"); await expect(planted).toHaveValue("0");
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByText("Leftover cannot exceed the 8 seedlings available.", { exact: true })).toBeVisible();
  await expect(leftover).toHaveAttribute("aria-invalid", "true"); await expect(leftover).toBeFocused();
  await leftover.fill("-1"); await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByText("Enter a nonnegative whole number.", { exact: true })).toBeVisible();
  await leftover.fill("2"); await expect(planted).toHaveValue("6");
  await page.getByLabel("Reason for Leftover Seedlings *", { exact: true }).fill("Seedlings damaged during transport");
  await page.getByRole("button", { name: "Take Photo", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
  await expect(page.getByText("Backend-verified camera capture", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("dialog", { name: "Submit Official Planting Report" })).toHaveCount(0);
  const request = fixture.calls.find(call => call.key === "POST /api/planting-reports/official");
  expect(request.body.expectedVersion).toBe(3); expect(request.body.items).toEqual([{ inventoryId: "narra", quantityPlanted: 6, leftoverQuantity: 2, leftoverReason: "Seedlings damaged during transport" }]);
  expect(request.body).not.toHaveProperty("staffName"); expect(request.body).not.toHaveProperty("requesterName"); expect(request.body).not.toHaveProperty("quantityReleased"); fixture.check();
});
test("individual release-based preview excludes leftovers and optional attendance uses the protected multipart endpoint", async ({ page }) => {
  const fixture = await staffForm(page, { "PUT /api/planting-reports/official/submission-fixture/attendance": (route, request) => {
    expect(request.headers()["content-type"]).toMatch(/^multipart\/form-data; boundary=/); expect(request.postDataBuffer().toString()).toContain('name="attendance"');
    return route.fulfill({ json: { success: true, data: { hasAttendance: true } } });
  } });
  await page.getByLabel("Confirmation Basis").selectOption("release-based");
  await page.getByLabel("Final Leftover Seedlings (Not Planted)").fill("2");
  await page.getByLabel("Reason for Leftover Seedlings *", { exact: true }).fill("Seedlings damaged during transport");
  await expect(page.getByLabel("Quantity Planted *")).toHaveValue("6"); await expect(page.getByLabel("Quantity Planted *")).toHaveAttribute("readonly");
  await page.getByLabel("Attendance Photo/File (Optional)").setInputFiles({ name: "attendance.pdf", mimeType: "application/pdf", buffer: Buffer.from("test-boundary-file; backend validates actual PDF in separate tests") });
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(fixture.calls.filter(call => call.key === "PUT /api/planting-reports/official/submission-fixture/attendance")).toHaveLength(1); fixture.check();
});

test("field report requires verified photos and keeps authoritative identity read-only", async ({ page }) => {
  const fixture = await staffForm(page);
  await expect(page.getByRole("heading", { name: "Narra", exact: true })).toBeVisible();
  await expect(page.getByLabel("Barangay", { exact: true })).toHaveValue("Bical");
  await expect(page.getByLabel("Site Latitude", { exact: true })).toHaveAttribute("readonly");
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Add at least one original planting photo" })).toBeVisible();
  expect(fixture.calls.filter(call => call.key === "POST /api/planting-reports/official")).toHaveLength(0);
  await page.getByRole("button", { name: "Take Photo", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Secure planting camera", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Submit Official Planting Report", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Take Photo", exact: true })).toBeFocused();
  fixture.check();
});

test("shared optional attendance validates files, previews images and removes only the unsaved selection", async ({ page }) => {
  const fixture = await staffForm(page);
  await page.getByLabel("Confirmation Basis").selectOption("release-based");
  const input = page.getByLabel("Attendance Photo/File (Optional)");
  await input.setInputFiles({ name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(page.getByRole("button", { name: "Choose Attendance File" })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").filter({ hasText: "Choose one PDF" })).toBeVisible();
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("button", { name: "Choose Attendance File" })).toBeFocused();
  expect(fixture.calls.filter(call => call.key === "POST /api/planting-reports/official")).toHaveLength(0);
  await input.setInputFiles({ name: "attendance.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQkAAAAASUVORK5CYII=", "base64") });
  await expect(page.getByAltText("Attendance preview: attendance.png")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose Attendance File" })).toHaveAttribute("aria-invalid", "false");
  await page.getByRole("button", { name: "Remove attendance.png", exact: true }).click();
  await expect(page.getByAltText("Attendance preview: attendance.png")).toHaveCount(0);
  const drop = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQkAAAAASUVORK5CYII="), value => value.charCodeAt(0));
    transfer.items.add(new File([bytes], "dropped.png", { type: "image/png" })); return transfer;
  });
  await page.locator(".attendance-dropzone").dispatchEvent("drop", { dataTransfer: drop }); await drop.dispose();
  await expect(page.getByAltText("Attendance preview: dropped.png")).toBeVisible();
  await page.getByRole("button", { name: "Remove dropped.png", exact: true }).click();
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("dialog", { name: "Submit Official Planting Report", exact: true })).toHaveCount(0);
  expect(fixture.calls.filter(call => call.key.startsWith("DELETE"))).toHaveLength(0);
  fixture.check();
});

test("interrupted Staff photo upload retries the same intent without submitting quantities twice", async ({ page }) => {
  const keys = []; let attempts = 0;
  const fixture = await staffForm(page, { "PUT /api/planting-reports/official/submission-fixture/photos": (route, request) => {
    keys.push(request.headers()["idempotency-key"]); attempts++;
    return route.fulfill(attempts === 1 ? { status: 503, json: { success: false, message: "Storage unavailable" } } : { json: { success: true, data: { evidenceVerified: true } } });
  } });
  await page.getByRole("button", { name: "Take Photo", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /^Report saved — retry evidence\./ })).toContainText("Storage unavailable");
  await expect(page.getByRole("group", { name: "Location Verification", exact: true }).getByRole("alert")).toHaveText("Storage unavailable");
  await expect(page.getByRole("button", { name: "Take Photo", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Upload Evidence for Saved Report", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Submit Official Planting Report", exact: true })).toHaveCount(0);
  expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]);
  expect(fixture.calls.filter(call => call.key === "POST /api/planting-reports/official")).toHaveLength(1); fixture.check();
});

for (const status of [400, 422]) test(`Staff photo correction after HTTP ${status} does not scroll an old form error back into view`, async ({ page }) => {
  const message = "Replace the rejected original photo with valid planting evidence.";
  const keys = []; let attempts = 0;
  const fixture = await staffForm(page, { "PUT /api/planting-reports/official/submission-fixture/photos": (route, request) => {
    keys.push(request.headers()["idempotency-key"]);
    return ++attempts === 1 ? route.fulfill({ status, json: { success: false, message, fieldErrors: { photos: message } } })
      : route.fulfill({ json: { success: true, data: { evidenceVerified: true } } });
  } });
  await takeFixturePhoto(page);
  await page.getByRole("button", { name: "Submit for Admin Verification", exact: true }).click();
  const card = page.getByRole("group", { name: "Location Verification", exact: true });
  await expect(card.getByRole("alert")).toHaveText(message);
  const remove = page.getByRole("button", { name: /^Remove planting photo / });
  await expect(remove).toBeEnabled();
  await page.evaluate(() => {
    window.__footerScrolls = [];
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(options) {
      if (this.matches(".pr-official-form-error")) window.__footerScrolls.push(this.textContent);
      return scroll.call(this, options);
    };
  });
  await remove.click();
  await expect(card).toHaveAttribute("aria-invalid", "false");
  // Wait for React's post-commit effect and paint, rather than using a sleep.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => window.__footerScrolls)).toEqual([]);
  await expect(page.getByRole("button", { name: "Upload Evidence for Saved Report", exact: true })).toBeVisible();
  await takeFixturePhoto(page);
  await page.getByRole("button", { name: "Upload Evidence for Saved Report", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Submit Official Planting Report", exact: true })).toHaveCount(0);
  expect(keys).toHaveLength(2); expect(keys[0]).toBeTruthy(); expect(keys[1]).not.toBe(keys[0]);
  expect(fixture.calls.filter(call => call.key === "POST /api/planting-reports/official")).toHaveLength(1);
  fixture.check();
});

test("pending saved Staff report can resume verified evidence without reposting planting quantities", async ({ page }) => {
  const submission = { id: "submission-fixture", requestId: "released-request", inventoryId: "narra", species: "Narra", quantity: 2, leftoverQuantity: 0, revision: 0,
    officialStaffReport: true, authenticatedSubmitterUid: "test-staff", confirmationBasis: "menro-field-report", staffReviewStatus: "Pending Review", adminApprovalRequired: true, photos: [] };
  const report = { id: "report-fixture", reportType: "parent", verificationStatus: "Partial", quantityReleased: 10, quantityPlanted: 2, submissions: [submission], photos: [] };
  const fixture = await staffForm(page, { "GET /api/planting-reports": route => route.fulfill({ json: { success: true, data: [report] } }),
    "GET /api/planting-reports/report-fixture": route => route.fulfill({ json: { success: true, data: report } }) });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("/staff/planting-reports?role=staff&report=report-fixture");
  await page.getByRole("button", { name: "Add Verified Planting Evidence", exact: true }).click();
  await expect(page.getByLabel("Quantity Planted *")).toBeDisabled();
  await page.getByRole("button", { name: "Take Photo", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
  await page.getByRole("button", { name: "Upload Evidence for Saved Report", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add Verified Planting Evidence", exact: true })).toHaveCount(0);
  expect(fixture.calls.filter(call => call.key === "POST /api/planting-reports/official")).toHaveLength(0); fixture.check();
});

test("login toast is fixed below topbar, dismissible and does not reappear on refresh", async ({ page }) => {
  const fixture = await setup(page);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("fixture-login-seeded")) {
      sessionStorage.setItem("fixture-login-seeded", "true");
      sessionStorage.setItem("menro:pending-dashboard-login", JSON.stringify({ uid: "test-staff", nonce: "fixture-once", createdAt: Date.now() }));
    }
  });
  await page.goto("/staff/dashboard?role=staff");
  const toast = page.getByRole("status").filter({ hasText: "Login Successful" });
  await expect(toast).toContainText("Welcome back! You have successfully signed in.");
  await expect(toast).toHaveCSS("border-top-color", "rgb(152, 201, 172)"); await expect(toast).toHaveCSS("border-top-width", "1px");
  await expect(page.locator(".menro-toast-viewport:has(.menro-toast-floating)")).toHaveCSS("position", "fixed");
  const topbar = page.locator(".topbar"); const before = await topbar.boundingBox();
  await page.getByRole("button", { name: "Dismiss Login Successful", exact: true }).click();
  await expect(toast).toHaveCount(0); expect(await topbar.boundingBox()).toEqual(before);
  await page.reload(); await expect(page.getByText("Login Successful", { exact: true })).toHaveCount(0);
  fixture.check();
});
// A first sign-in (reported by the backend as firstLogin) says "Welcome!" in the same green-bordered login alert.
test("first-time login alert says Welcome! with the returning-login design", async ({ page }) => {
  const fixture = await setup(page);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("fixture-login-seeded")) {
      sessionStorage.setItem("fixture-login-seeded", "true");
      sessionStorage.setItem("menro:pending-dashboard-login", JSON.stringify({ uid: "test-staff", nonce: "fixture-first", createdAt: Date.now(), firstLogin: true }));
    }
    // Each placement of the login alert in the document: always in the top layer (never under <body> while a native dialog
    // such as the first-visit guide is open, where it would be drawn behind it), and always the same element (moved with
    // its layer when a dialog opens or closes, never remounted and re-announced).
    window.__loginAlertInsertions = [];
    new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue;
      for (const toast of [node, ...node.querySelectorAll(".menro-toast")].filter(el => el.matches?.(".menro-toast-floating"))) {
        const open = [...document.querySelectorAll("dialog[open]")]; window.__firstLoginAlert ??= toast;
        window.__loginAlertInsertions.push({ inTopLayer: open.length ? open.at(-1).contains(toast) : true, sameElement: toast === window.__firstLoginAlert });
      } } }).observe(document, { subtree: true, childList: true });
  });
  await page.goto("/staff/dashboard?role=staff");
  const toast = page.getByRole("status").filter({ hasText: "Login Successful" });
  await expect(toast).toContainText("Welcome! You have successfully signed in.");
  await expect(toast).not.toContainText("Welcome back!");
  const placements = await page.evaluate(() => window.__loginAlertInsertions);
  expect(placements.length).toBeGreaterThan(0);
  expect(placements.every(placement => placement.inTopLayer && placement.sameElement)).toBe(true);
  expect(await page.evaluate(() => document.querySelector(".menro-toast-floating") === window.__firstLoginAlert)).toBe(true);
  await expect(toast).toHaveCSS("border-top-color", "rgb(152, 201, 172)"); await expect(toast).toHaveCSS("border-top-width", "1px");
  await expect(page.locator(".menro-toast-viewport:has(.menro-toast-floating)")).toHaveCSS("position", "fixed");
  await page.getByRole("button", { name: "Dismiss Login Successful", exact: true }).click(); await expect(toast).toHaveCount(0);
  fixture.check();
});
test("stale reportable balance displays a general conflict and never silently changes expectedVersion", async ({ page }) => {
  const fixture = await staffForm(page, { "POST /api/planting-reports/official": route => route.fulfill({ status: 409, json: { success: false, message: "The reportable balance changed." } }) });
  await page.getByRole("button", { name: "Take Photo", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
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

async function plantingDetails(page, { proposed = false, blankArea = false, group = false, delivery = false } = {}) {
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
  if (proposed && !blankArea) {
    await page.getByLabel("Planting Area (Hectares) (Optional)", { exact: true }).selectOption("Other / Exact Area");
    await page.getByLabel("Specify Planting Area (Hectares)").fill("0.5");
  }
  await page.getByRole("radio", { name: delivery ? "MENRO Delivery" : "Pick-up", exact: true }).check();
  if (group) await page.getByLabel("Event Name *", { exact: true }).fill("Fixture school greening");
  await page.getByLabel(group ? "Proposed Event Date *" : "Planned Planting Date *", { exact: true }).fill("2099-01-02");
  await page.getByLabel(/Start Time/).fill("08:00");
  if (group) await page.getByLabel("End Time *", { exact: true }).fill("10:00");
  await page.getByLabel(group ? "Expected Participants *" : "Planned Number of Planters *", { exact: true }).fill(group ? "10" : "1");
  await expect(page.getByText("Planting Care Information", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel(/Who will be responsible|How often do you plan|How will you care/)).toHaveCount(0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Identification Type *")).toBeVisible();
  await page.getByLabel("Identification Type *").selectOption("national_id");
  await page.getByLabel("ID Number *").fill("1234-5678-9012-3456");
  await page.getByRole("checkbox", { name: /confirm that the information/ }).check();
}

test("existing site submits its registered area with the authoritative coordinates", async ({ page }) => {
  const fixture = await setup(page); await requester(page); await plantingDetails(page);
  await page.getByRole("button", { name: "Submit Request", exact: true }).click();
  await expect(page).toHaveURL(/participant\/my-requests/);
  const submission = fixture.calls.find(call => call.key === "POST /api/seedling-requests").body;
  for (const field of ["caretaker", "carePlan", "monitoringFrequency", "monitoringOther"]) expect(submission.workflow).not.toHaveProperty(field);
  expect(submission.workflow.areaChoice).toBe(""); expect(submission.workflow.exactArea).toBe(""); expect(submission.workflow.plantingAreaHectares).toBe(1.5);
  expect(submission.eventProposal.latitude).toBe(site.latitude); expect(submission.eventProposal.longitude).toBe(site.longitude);
  fixture.check();
});

test("proposed site submits an entered exact area", async ({ page }) => {
  const fixture = await setup(page); await requester(page); await plantingDetails(page, { proposed: true });
  await page.getByRole("button", { name: "Submit Request", exact: true }).click();
  await expect(page).toHaveURL(/participant\/my-requests/);
  const submission = fixture.calls.find(call => call.key === "POST /api/seedling-requests").body;
  expect(submission.workflow.areaChoice).toBe("Other / Exact Area"); expect(submission.workflow.exactArea).toBe("0.5"); expect(submission.workflow.plantingAreaHectares).toBe(0.5);
  fixture.check();
});

test("existing site hides the area input, shows the registered area and clears area on site-type switches", async ({ page }) => {
  const noArea = { ...site, id: "site-2", siteName: "Unmeasured site", areaHectares: null };
  const fixture = await setup(page, { "GET /api/sites": route => route.fulfill({ json: { success: true, data: [site, noArea] } }) });
  await requester(page);
  await page.getByLabel("Barangay *", { exact: true }).selectOption("Bical");
  await expect(page.getByLabel("Planting Area *", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Planting Area (Hectares) (Optional)", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Planting Area (Registered Site Area)")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Planting Site *", exact: true }).selectOption("site-1");
  const registered = page.getByLabel("Planting Area (Registered Site Area)", { exact: true });
  await expect(registered).toHaveValue("1.5 ha"); await expect(registered).toHaveAttribute("readonly");
  await page.getByRole("combobox", { name: "Planting Site *", exact: true }).selectOption("site-2");
  await expect(registered).toHaveValue("Not recorded for this site");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("[data-validation-field=areaChoice], [data-validation-field=exactArea]")).toHaveCount(0);
  await page.getByRole("radio", { name: "Propose New Planting Site", exact: true }).check();
  const optional = page.getByLabel("Planting Area (Hectares) (Optional)", { exact: true });
  await expect(optional).toHaveValue(""); await optional.selectOption("2 hectares");
  await page.getByRole("radio", { name: "Select Existing Planting Site", exact: true }).check();
  await page.getByRole("radio", { name: "Propose New Planting Site", exact: true }).check();
  await expect(optional).toHaveValue("");
  fixture.check();
});

test("backend field validation returns to the right step and focuses its inline control", async ({ page }) => {
  const fixture = await setup(page, { "POST /api/seedling-requests": route => route.fulfill({ status: 400, json: { success: false, message: "Invalid area", fieldErrors: { exactArea: "Choose the exact area shown on the site record." } } }) });
  await requester(page); await plantingDetails(page, { proposed: true });
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
  await page.getByRole("radio", { name: "Propose New Planting Site", exact: true }).check();
  const area = page.getByLabel("Planting Area (Hectares) (Optional)", { exact: true });
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

test("Participant form retains planting fields and traps keyboard focus with optional attendance", async ({ page }) => {
  const fixture = await setup(page);
  await page.goto("/participant/my-planting-reports?role=participant");
  const trigger = page.getByRole("button", { name: "Submit Planting Report", exact: true }); await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Submit Planting Report", exact: true }); await expect(dialog).toBeVisible();
  await expect(dialog.locator(".pr-final-report")).toBeVisible();
  await expect(dialog.getByText("Select the released seedling distribution first.", { exact: true })).toBeVisible();
  await expect(page.locator("#planting-quantity")).toHaveCount(0);
  await expect(page.locator("#planting-confirmation-mode")).toHaveCount(0);
  await expect(page.getByLabel("Attendance Photo/File (Optional)")).toHaveCount(1);
  const close = dialog.getByRole("button", { name: "Close", exact: true }); await close.focus();
  await page.keyboard.press("Shift+Tab"); await expect(dialog.getByRole("button", { name: "Submit Report", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(close).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); fixture.check();
});

test("parent gallery and submission thumbnail share one authenticated private image request", async ({ page }) => {
  const photo = { hasEvidence: true, latitude: site.latitude, longitude: site.longitude };
  const report = { id: "shared-photo-report", reportType: "parent", verificationStatus: "Partial", quantityReleased: 10, quantityPlanted: 2, photos: [photo],
    submissions: [{ id: "owned-row", quantity: 2, photos: [photo], staffReviewStatus: "Pending Review" }] };
  let release; const gate = new Promise(resolve => { release = resolve; }); let requests = 0;
  const fixture = await setup(page, { "GET /api/planting-reports": route => route.fulfill({ json: { success: true, data: [report] } }),
    "GET /api/planting-reports/shared-photo-report": route => route.fulfill({ json: { success: true, data: report } }),
    "GET /api/evidence/planting-reports/shared-photo-report/photos/0": async route => {
      requests++; await gate; return route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQkAAAAASUVORK5CYII=", "base64") });
    } });
  await page.goto("/staff/planting-reports?role=staff&report=shared-photo-report");
  await expect(page.getByText("Loading photo…", { exact: true })).toHaveCount(2);
  await expect.poll(() => requests).toBe(1); release();
  await expect(page.locator('.pr-report-drawer img[src^="blob:"]')).toHaveCount(2);
  expect(requests).toBe(1); fixture.check();
});

const ownRequest = (status = "Pending", owner = "test-staff") => ({
  id: "staff-own-request", requestNumber: "REQ-2099-001", participantId: owner,
  participantName: "Staff Requester", requesterRole: "staff", status, requestVersion: 3,
  contactNumber: "09123456789", organization: "", purpose: "Backyard / Home Planting",
  plantingLocation: "Bical, Bulan", preferredReleaseDate: "2099-01-01", createdAt: "2026-11-05T01:00:00Z",
  items: [{ inventoryId: "tree-1", species: "Narra", quantity: 2 }],
  workflow: { sector: "Resident / Individual", effectiveRequestType: "individual", purpose: "Backyard / Home Planting", addressProvince: "Sorsogon", addressMunicipality: "Bulan", addressBarangay: "Bical", street: "Fixture street", siteMode: "existing", siteBarangay: "Bical", existingSiteId: "site-1", areaChoice: "1 hectare", releaseMethod: "Pick-up", caretaker: "Staff Requester", carePlan: "Water weekly", monitoringFrequency: "Weekly" },
  eventProposal: { eventName: "Individual planting schedule", barangay: "Bical", plantingSiteId: "site-1", proposedDate: "2099-01-02", proposedStartTime: "08:00", proposedEndTime: "", expectedParticipants: 1 },
});

test("Staff opens one assisted form with no requester mode choice and validates required requester fields", async ({ page }) => {
  const fixture = await setup(page);
  await page.goto("/staff/requests?role=staff");
  const trigger = page.getByRole("button", { name: "Submit Seedling Request", exact: true }); await trigger.focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/staff\/request-seedlings/);
  await expect(page.getByRole("radio", { name: "For a Requester", exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "For Myself", exact: true })).toHaveCount(0);
  const assisted = page.getByLabel("Assisted By Staff *", { exact: true });
  await expect(assisted).toHaveValue(""); await expect(assisted).toHaveAttribute("placeholder", "Name of Staff"); await expect(assisted).not.toHaveAttribute("readonly");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(assisted).toBeFocused(); await expect(page.getByText("Enter the name of the assisting staff.", { exact: true })).toBeVisible();
  await assisted.fill("   "); await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Enter the name of the assisting staff.", { exact: true })).toBeVisible();
  await assisted.fill("Maria Santos"); await expect(page.getByText("Enter the name of the assisting staff.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Full Name *", { exact: true })).toBeFocused();
  await page.getByLabel("Full Name *", { exact: true }).fill("Citizen Requester");
  const contact = page.getByLabel("Contact Number *", { exact: true });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Enter a valid Philippine mobile or landline number.")).toBeVisible();
  await contact.fill("12345"); await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Enter a valid Philippine mobile or landline number.")).toBeVisible();
  await contact.fill("(056) 211-1234"); await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Enter a valid Philippine mobile or landline number.")).toHaveCount(0);
  await expect(page.getByLabel("Requesting As *", { exact: true })).toBeFocused(); fixture.check();
});

for (const [role, status] of [["staff", "Pending"], ["staff", "Approved"], ["admin", "Reviewed"]]) {
  test(`${role} requester cannot process their own ${status} request in the management view`, async ({ page }) => {
    const request = ownRequest(status, `test-${role}`);
    const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }) });
    await page.goto(`/${role}/requests?role=${role}`);
    await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click();
    for (const action of ["Review", "Return Request", "Approve", "Reject", "Release Seedlings"]) await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
    if (role === "staff") await expect(page.getByRole("button", { name: "Manage My Request" })).toBeVisible();
    expect(fixture.calls.filter(call => call.key.startsWith("PATCH"))).toHaveLength(0); fixture.check();
  });
}

test("independent Staff retains normal review controls for another request", async ({ page }) => {
  const request = ownRequest("Pending", "other-requester");
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }) });
  await page.goto("/staff/requests?role=staff"); await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Return Request", exact: true })).toBeVisible(); fixture.check();
});

const siteInstruction = "Verify the proposed site's area and capacity before forwarding this request for Admin approval.";
const proposedSiteRequest = (extra = {}) => {
  const request = ownRequest("Pending", "other-requester");
  return { ...request, ...extra, workflow: { ...request.workflow, siteMode: "proposed", existingSiteId: "", areaChoice: "", siteReviewRequired: true, siteName: "Proposed fixture site", latitude: 12.6598, longitude: 123.918 },
    eventProposal: { ...request.eventProposal, plantingSiteId: "PROPOSED" } };
};
async function openStaffReview(page, request, overrides = {}) {
  const reviews = [];
  const fixture = await setup(page, {
    "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }),
    "PATCH /api/seedling-requests/staff-own-request/review": route => { reviews.push(route.request().postDataJSON()); return overrides.review ? overrides.review(route) : route.fulfill({ json: { success: true, data: { ...request, status: "Reviewed", requestVersion: 4 } } }); },
  });
  await page.goto("/staff/requests?role=staff");
  await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Review Seedling Request" });
  await expect(modal).toBeVisible();
  return { fixture, reviews, modal };
}

test("Staff review of an existing registered site hides manual site verification and submits without it", async ({ page }) => {
  const { fixture, reviews, modal } = await openStaffReview(page, ownRequest("Pending", "other-requester"));
  await expect(modal.getByText(siteInstruction)).toHaveCount(0);
  await expect(modal.getByRole("button", { name: /Site Verification/ })).toHaveCount(0);
  await expect(modal.getByLabel(/Verified Planting Area/)).toHaveCount(0);
  await expect(modal.getByLabel(/Verified Site Capacity/)).toHaveCount(0);
  await expect(modal.getByLabel("Proposed Planting Date *")).toBeVisible();
  await modal.getByRole("button", { name: "Complete Review", exact: true }).click();
  await expect.poll(() => reviews.length).toBe(1);
  expect(reviews[0]).not.toHaveProperty("siteVerification");
  expect(reviews[0].expectedVersion).toBe(3);
  fixture.check();
});

test("Staff review of a proposed site keeps verification in a collapsed Site Verification section and never submits blank values", async ({ page }) => {
  const { fixture, reviews, modal } = await openStaffReview(page, proposedSiteRequest());
  await expect(modal.getByText(siteInstruction)).toHaveCount(0);
  const toggle = modal.getByRole("button", { name: /Site Verification/ });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toContainText("Required");
  await expect(modal.getByLabel("Verified Planting Area (Hectares) *")).toHaveCount(0);
  await expect(modal.getByLabel("Proposed Planting Date *")).toBeVisible();

  await modal.getByRole("button", { name: "Complete Review", exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const area = modal.getByLabel("Verified Planting Area (Hectares) *");
  const capacity = modal.getByLabel("Verified Site Capacity (Seedlings) *");
  await expect(area).toBeFocused();
  await expect(area).toHaveAttribute("aria-invalid", "true");
  await expect(capacity).toHaveAttribute("aria-invalid", "true");
  expect(reviews).toHaveLength(0);

  await area.fill("0.5"); await capacity.fill("30");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toContainText("0.5 ha");
  await expect(toggle).toContainText("30 seedlings");
  await modal.getByRole("button", { name: "Complete Review", exact: true }).click();
  await expect.poll(() => reviews.length).toBe(1);
  expect(reviews[0].siteVerification).toEqual({ areaHectares: "0.5", maximumCapacity: "30" });
  fixture.check();
});

test("backend site-verification errors reopen the Site Verification section on the failing field", async ({ page }) => {
  const { fixture, reviews, modal } = await openStaffReview(page, proposedSiteRequest(), {
    review: route => route.fulfill({ status: 400, json: { success: false, message: "Enter the Staff-verified proposed site area and capacity.", fieldErrors: { verifiedMaximumCapacity: "Enter the verified capacity as a positive whole number." } } }),
  });
  const toggle = modal.getByRole("button", { name: /Site Verification/ });
  await toggle.click();
  await modal.getByLabel("Verified Planting Area (Hectares) *").fill("0.5");
  await modal.getByLabel("Verified Site Capacity (Seedlings) *").fill("30");
  await toggle.click();
  await modal.getByRole("button", { name: "Complete Review", exact: true }).click();
  await expect.poll(() => reviews.length).toBe(1);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const capacity = modal.getByLabel("Verified Site Capacity (Seedlings) *");
  await expect(capacity).toHaveAttribute("aria-invalid", "true");
  await expect(capacity).toBeFocused();
  await expect(modal.getByText("Enter the verified capacity as a positive whole number.")).toBeVisible();
  await expect(modal).toBeVisible();
  fixture.check();
});

test("previously recorded site verification opens expanded for Staff to re-confirm before submitting", async ({ page }) => {
  const { fixture, reviews, modal } = await openStaffReview(page, proposedSiteRequest({ proposedSiteVerification: { areaHectares: 1.2, maximumCapacity: 400 } }));
  const toggle = modal.getByRole("button", { name: /Site Verification/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(modal.getByLabel("Verified Planting Area (Hectares) *")).toHaveValue("1.2");
  await expect(modal.getByLabel("Verified Site Capacity (Seedlings) *")).toHaveValue("400");
  expect(reviews).toHaveLength(0);
  fixture.check();
});

for (const viewport of [{ width: 1366, height: 820 }, { width: 390, height: 844 }]) {
  test(`proposed-site review modal fits without horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const { fixture, modal } = await openStaffReview(page, proposedSiteRequest());
    await modal.getByRole("button", { name: /Site Verification/ }).click();
    const fits = await modal.evaluate(node => node.scrollWidth <= node.clientWidth + 1);
    expect(fits).toBe(true);
    for (const name of ["Verified Planting Area (Hectares) *", "Verified Site Capacity (Seedlings) *"]) {
      const box = await modal.getByLabel(name).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    }
    fixture.check();
  });
}

for (const role of ["staff", "participant"]) {
test(`${role} returned request reopens the same wizard and resubmits with its authoritative version`, async ({ page }) => {
  const request = { ...ownRequest("Returned", `test-${role}`), returnReason: "Clarify care plan" }; let edited = false;
  const fixture = await setup(page, {
    "GET /api/seedling-requests/my": route => route.fulfill({ json: { success: true, data: [{ ...request, status: edited ? "Pending" : "Returned" }] } }),
    "GET /api/seedling-requests/staff-own-request": route => route.fulfill({ json: { success: true, data: request } }),
    "PATCH /api/seedling-requests/staff-own-request/resubmit": (route, req) => {
      expect(req.postDataJSON().expectedVersion).toBe(3); expect(req.postDataJSON().workflow.carePlan).toBe("Water weekly"); edited = true;
      return route.fulfill({ json: { success: true, data: { ...request, status: "Pending", requestVersion: 4 } } });
    },
  });
  await page.goto(`/${role}/my-requests?role=${role}&request=staff-own-request`);
  await page.getByRole("button", { name: "Edit Request", exact: true }).click(); await expect(page).toHaveURL(new RegExp(`/${role}/request-seedlings\\?edit=staff-own-request`));
  // The page header is gone; the Request ID stays visible inside the form on every step.
  await expect(page.locator(".sr-editing-request")).toHaveText(`Request ID ${request.requestNumber}`); await expect(page.locator(".sr-editing-request")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".sr-editing-request")).toBeVisible();
  await expect(page.getByLabel("Preferred Release Date *")).toHaveValue("2099-01-01");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Identification Type *")).toHaveCount(0);
  await page.getByRole("checkbox", { name: /confirm that the information/ }).check();
  await page.getByRole("button", { name: "Resubmit Request", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}/my-requests`)); expect(edited).toBe(true); fixture.check();
});
}

test("Participant and unauthenticated users cannot open Staff requester routes", async ({ page }) => {
  const fixture = await setup(page);
  for (const role of ["participant", "unauthenticated"]) {
    for (const path of ["request-seedlings", "my-requests"]) {
      await page.goto(`/staff/${path}?role=${role}`);
      await expect(page).not.toHaveURL(new RegExp(`/staff/${path}`));
    }
  }
  fixture.check();
});


test("Staff requester confirms the coordinated schedule through the shared owner page", async ({ page }) => {
  const request = { ...ownRequest(), preApprovalSchedule: { status: "AwaitingRequesterConfirmation", proposalVersion: 2, plantingDate: "2099-01-03", startTime: "09:00", endTime: "", preferredReleaseDate: "2099-01-01" } };
  const fixture = await setup(page, {
    "GET /api/seedling-requests/my": route => route.fulfill({ json: { success: true, data: [request] } }),
    "PATCH /api/seedling-requests/staff-own-request/pre-approval-schedule/confirm": (route, req) => {
      expect(req.postDataJSON()).toMatchObject({ expectedVersion: 3, proposalVersion: 2, plantingDate: "2099-01-03", startTime: "09:00" });
      return route.fulfill({ json: { success: true, data: { ...request, requestVersion: 4, preApprovalSchedule: { ...request.preApprovalSchedule, status: "Confirmed" } } } });
    },
  });
  await page.goto("/staff/my-requests?role=staff&request=staff-own-request");
  await expect(page.getByLabel("Planting Date *", { exact: true })).toHaveValue("2099-01-03");
  await page.getByRole("button", { name: "Confirm Planting Schedule", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm Planting Schedule", exact: true })).toHaveCount(0);
  expect(fixture.calls.filter(call => call.key.includes("/pre-approval-schedule/confirm"))).toHaveLength(1); fixture.check();
});


test("Requesting As preserves all sectors except the school split and shares purpose choices for students and organizations", async ({ page }) => {
  const fixture = await setup(page);
  await page.goto("/participant/request-seedlings?role=participant");
  const sector = page.getByLabel("Requesting As *", { exact: true });
  await expect(sector).toBeVisible();
  expect(await sector.locator("option").evaluateAll(options => options.map(option => option.value).filter(Boolean))).toEqual(["Resident / Individual", "Barangay Official", "Student (Individual)", "School Organization Representative", "Private Sector / Business", "Civic Organization / NGO", "Government Agency", "Other (please specify)"]);
  await sector.selectOption("Student (Individual)");
  await expect(page.getByLabel("School / Organization Name *")).toHaveCount(0);
  await page.getByLabel("School Name *", { exact: true }).fill("Fixture school");
  await expect(page.getByRole("radio", { name: "Individual / Student", exact: true })).toHaveCount(0);
  await page.getByLabel("Province *", { exact: true }).selectOption("Sorsogon"); await page.getByLabel("Municipality / City *", { exact: true }).selectOption("Bulan"); await page.getByLabel("Barangay *", { exact: true }).selectOption("Bical"); await page.getByLabel("Street / Purok / Sitio *").fill("Fixture street");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const purposes = await page.getByLabel("Purpose of Request *").locator("option").evaluateAll(options => options.map(option => option.value).filter(Boolean));
  expect(purposes).toEqual(["Household / Backyard", "Agroforestry / Fruit Tree", "Reforestation / Mangrove / Riverbank / Slope", "School / Community / Roadside Greening", "Replacement Planting", "Special Occasion", "Other"]);
  await page.getByRole("button", { name: "Back", exact: true }).click(); await sector.selectOption("School Organization Representative");
  await expect(page.getByLabel("School / Organization Name *")).toBeVisible(); await page.getByLabel("School / Organization Name *").fill("Fixture school organization");
  await expect(page.getByLabel("Representative Full Name")).toHaveCount(0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  expect(await page.getByLabel("Purpose of Request *").locator("option").evaluateAll(options => options.map(option => option.value).filter(Boolean))).toEqual(purposes); fixture.check();
});

test("Staff walk-in wizard records an actual citizen and signed receipt, not the Staff requester", async ({ page }) => {
  let encoded;
  const fixture = await setup(page, {
    "POST /api/seedling-requests/walk-in": (route, request) => {
      const multipart = request.postDataBuffer().toString(); expect(multipart).not.toContain('name="acknowledgement"'); expect(multipart).not.toContain('"receiptReference"');
      expect(multipart).toContain('"fullName":"Citizen Requester"'); expect(multipart).toContain('"contactNumber":"0917 123 4567"'); expect(multipart).toContain('"assistedByName":"Maria Santos"');
      encoded = { ...ownRequest(), id: "walkin-1", participantId: "walkin-citizen", participantName: "Citizen Requester", walkIn: { encodedBy: "test-staff", citizenHasAccount: false, receiptReference: "ACK-WALKIN-1" } };
      return route.fulfill({ status: 201, json: { success: true, data: encoded } });
    },
    "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: encoded ? [encoded] : [] } }),
  });
  await page.goto("/staff/requests?role=staff"); await page.getByRole("button", { name: "Submit Seedling Request", exact: true }).click();
  await page.getByLabel("Assisted By Staff *", { exact: true }).fill("Maria Santos");
  await expect(page.getByLabel("Full Name *", { exact: true })).toHaveValue(""); await page.getByLabel("Full Name *", { exact: true }).fill("Citizen Requester");
  await expect(page.getByLabel("Available Contact Number (Optional)")).toHaveCount(0);
  await expect(page.getByLabel("Contact Number *", { exact: true })).toHaveValue("");
  await page.getByLabel("Contact Number *", { exact: true }).fill("0917 123 4567");
  await requester(page, { role: "staff", navigate: false, heading: "Encode Walk-in Request" }); await plantingDetails(page);
  await expect(page.getByLabel("Assisted By Staff", { exact: true })).toHaveValue("Maria Santos");
  await expect(page.getByLabel("Assisted By Staff", { exact: true })).toHaveAttribute("readonly");
  await expect(page.getByLabel("Acknowledgement Receipt Reference *")).toHaveCount(0);
  await expect(page.getByLabel("Signed Acknowledgement *")).toHaveCount(0);
  await page.getByRole("button", { name: "Submit Request", exact: true }).click();
  await expect(page).toHaveURL(/staff\/requests/, { timeout: 10000 }); expect(encoded.participantName).toBe("Citizen Requester"); fixture.check();
});

const completedWalkIn = () => ({
  ...ownRequest("Reviewed", "walkin-school-citizen"),
  id: "walkin-school-1",
  requestNumber: "REQ-SCHOOL-1",
  participantName: "Test Organization Representative",
  requesterRole: "walk-in",
  createdByRole: "staff",
  submissionPath: "STAFF_DIRECT_TO_ADMIN",
  staffReviewRequired: false,
  reviewStatus: "Not Required",
  submittedByUid: "test-staff",
  submittedByName: "Test User",
  walkIn: { encodedBy: "test-staff", encodedByName: "Test User", citizenHasAccount: false },
});

async function completeStaffOrganizationWalkIn(page) {
  await page.goto("/staff/requests?role=staff"); await page.getByRole("button", { name: "Submit Seedling Request", exact: true }).click();
  await page.getByLabel("Assisted By Staff *", { exact: true }).fill("Test Staff Encoder");
  await page.getByLabel("Full Name *", { exact: true }).fill("Test Organization Representative");
  await page.getByLabel("Contact Number *", { exact: true }).fill("0917 000 0000");
  await requester(page, { role: "staff", navigate: false, sector: "School Organization Representative", detail: { label: "School / Organization Name *", value: "Test School Organization" }, purpose: "School / Community / Roadside Greening" });
  await plantingDetails(page, { group: true, delivery: true });
  await page.locator('input[type="file"].sr-request-letter-input').setInputFiles({ name: "school-request.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("test-only document fixture") });
  return page.getByRole("button", { name: "Submit Request", exact: true });
}

function expectLegacyLetterOnly(request) {
  const multipart = request.postDataBuffer().toString();
  expect(multipart).not.toContain('name="requestLetter"');
  expect(multipart).toContain('"requestLetter":{"name":"school-request.docx"');
  const clientSubmissionId = multipart.match(/"clientSubmissionId":"([^"]+)"/)?.[1];
  expect(clientSubmissionId).toBeTruthy();
  return clientSubmissionId;
}

test("Staff organization walk-in submits once, reaches Awaiting Approval, My Requests and Admin eligibility", async ({ page }) => {
  let attempts = 0, encoded = null;
  const fixture = await setup(page, {
    "POST /api/seedling-requests/walk-in": async (route, request) => {
      attempts += 1; encoded = { ...completedWalkIn(), clientSubmissionId: expectLegacyLetterOnly(request) };
      await new Promise(resolve => setTimeout(resolve, 100));
      return route.fulfill({ status: 201, json: { success: true, data: encoded } });
    },
    "GET /api/seedling-requests/my": route => route.fulfill({ json: { success: true, data: encoded ? [encoded] : [] } }),
    "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: encoded ? [encoded] : [] } }),
  });
  const submit = await completeStaffOrganizationWalkIn(page);
  await submit.evaluate(button => { button.click(); button.click(); });
  await expect(page).toHaveURL(/staff\/requests/);
  await expect(page.getByRole("cell", { name: "Awaiting Approval", exact: true })).toBeVisible();
  expect(attempts).toBe(1);

  await page.goto("/staff/my-requests?role=staff");
  await expect(page.getByRole("cell", { name: "Awaiting Approval", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /View details of/ })).toBeVisible();
  await page.goto("/admin/requests?role=admin");
  await page.getByRole("button", { name: /View details for/ }).click();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toBeVisible();
  fixture.check();
});

test("Staff organization walk-in keeps every entry after 503 and succeeds on retry without letter bytes", async ({ page }) => {
  let attempts = 0;
  const fixture = await setup(page, {
    "POST /api/seedling-requests/walk-in": (route, request) => {
      attempts += 1; const clientSubmissionId = expectLegacyLetterOnly(request);
      if (attempts === 1) return route.fulfill({ status: 503, json: { success: false, message: "Secure request-letter storage is not enabled." } });
      return route.fulfill({ status: 201, json: { success: true, data: { ...completedWalkIn(), clientSubmissionId } } });
    },
  });
  const submit = await completeStaffOrganizationWalkIn(page);
  await submit.click();
  await expect(page.getByText(/Secure request-letter storage is not enabled/)).toBeVisible();
  await expect(page.getByText("school-request.docx", { exact: true })).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(/staff\/requests/);
  expect(attempts).toBe(2); fixture.check();
});

test("ambiguous Staff walk-in response reconciles the persisted request without a duplicate POST", async ({ page }) => {
  let attempts = 0, encoded = null;
  const fixture = await setup(page, {
    "POST /api/seedling-requests/walk-in": (route, request) => {
      attempts += 1; encoded = { ...completedWalkIn(), clientSubmissionId: expectLegacyLetterOnly(request) };
      return route.abort("connectionfailed");
    },
    "GET /api/seedling-requests/my": route => route.fulfill({ json: { success: true, data: encoded ? [encoded] : [] } }),
  });
  const submit = await completeStaffOrganizationWalkIn(page);
  await submit.click();
  await expect(page).toHaveURL(/staff\/requests/);
  expect(attempts).toBe(1); fixture.check();
});

test("Admin purpose settings publish a version and keep unapproved thresholds and sampling minimum pending", async ({ page }) => {
  const purposes = ["Household / Backyard", "Agroforestry / Fruit Tree", "Reforestation / Mangrove / Riverbank / Slope", "School / Community / Roadside Greening", "Replacement Planting", "Special Occasion", "Other"];
  const policy = { version: 0, effectiveDate: null, updatedBy: null, sampling: { percentage: 10, minimum: null, firstVisitDelayWeeks: null, intervalMonths: 12, speciesAllocationProcedure: null, physicalSelectionProcedure: null }, purposes: purposes.map(purpose => ({ purpose, reporting: "OPTIONAL", monitoring: "NONE", quantityThreshold: null, organizationCondition: null })) };
  let saved;
  const fixture = await setup(page, { "GET /api/purpose-policies": route => route.fulfill({ json: { success: true, data: policy } }),
    "PUT /api/purpose-policies": (route, request) => { saved = request.postDataJSON(); expect(saved.expectedVersion).toBe(0); expect(saved.sampling.minimum).toBeNull(); expect(saved.purposes[1].quantityThreshold).toBeNull(); return route.fulfill({ json: { success: true, data: { ...policy, ...saved, version: 1, updatedBy: "test-admin" } } }); } });
  await page.goto("/admin/settings?role=admin"); await expect(page.getByRole("heading", { name: "Purpose Reporting and Permanent Sample Policies" })).toBeVisible();
  await page.getByLabel("Effective Date", { exact: true }).fill("2026-11-06"); await page.getByLabel("Audit Reason", { exact: true }).fill("MENRO reviewed the purpose configuration");
  await page.getByRole("button", { name: "Save Versioned Purpose Policy", exact: true }).click();
  await expect(page.getByText(/Policy version: 1/)).toBeVisible(); expect(saved).not.toHaveProperty("updatedBy"); fixture.check();
});

test("Participant evidence, location map and attendance keep stable approved section order", async ({ page }) => {
  const fixture = await setup(page); await page.goto("/participant/my-planting-reports?role=participant");
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  const sections = await page.locator(".pr-photo-evidence-section, .pr-photo-location-section, .pr-report-additional-section, .attendance-upload").evaluateAll(nodes => nodes.map(node => node.className));
  expect(sections[0]).toContain("pr-photo-evidence-section"); expect(sections[1]).toContain("pr-photo-location-section"); expect(sections[2]).toContain("pr-report-additional-section"); expect(sections[3]).toContain("attendance-upload");
  await expect(page.getByRole("button", { name: "Take Photo", exact: true })).toHaveCount(1); await expect(page.getByRole("button", { name: "Upload Existing Photos", exact: true })).toHaveCount(1); fixture.check();
});

test("original Staff encoder records a signed walk-in schedule without a citizen account", async ({ page }) => {
  const request = { ...ownRequest(), participantId: "walk-in-citizen", participantName: "Citizen", walkIn: { encodedBy: "test-staff", citizenHasAccount: false },
    preApprovalSchedule: { status: "AwaitingRequesterConfirmation", proposalVersion: 2, plantingDate: "2099-01-03", startTime: "09:00" } };
  let recorded = false;
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [{ ...request, preApprovalSchedule: { ...request.preApprovalSchedule, status: recorded ? "Confirmed" : "AwaitingRequesterConfirmation" } }] } }),
    "PATCH /api/seedling-requests/walk-in/staff-own-request/schedule": (route, req) => {
      const body = req.postDataBuffer().toString(); expect(body).toContain('"expectedVersion":3'); expect(body).toContain('"proposalVersion":2'); expect(body).toContain('"action":"confirm"'); expect(body).toContain('name="acknowledgement"');
      recorded = true; return route.fulfill({ json: { success: true, data: { ...request, requestVersion: 4, preApprovalSchedule: { ...request.preApprovalSchedule, status: "Confirmed" } } } });
    } });
  await page.goto("/staff/requests?role=staff"); await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click();
  await page.getByRole("button", { name: "Record Signed Schedule Acknowledgement", exact: true }).click();
  await expect(page.getByLabel("Schedule Receipt Reference", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Schedule Receipt Reference", { exact: true }).fill("SIGNED-ACK-123");
  await page.getByLabel("Signed Schedule Acknowledgement", { exact: true }).setInputFiles({ name: "signed.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQkAAAAASUVORK5CYII=", "base64") });
  await page.getByRole("button", { name: "Record Signed Schedule Acknowledgement", exact: true }).click();
  await expect(page.getByRole("button", { name: "Record Signed Schedule Acknowledgement", exact: true })).toHaveCount(0); expect(recorded).toBe(true); fixture.check();
});

async function expectAutomaticApproval(modal) {
  for (const label of ["Reporting Requirement", "Monitoring Requirement", "Policy Decision Reason"]) await expect(modal.getByLabel(label, { exact: true })).toHaveCount(0);
  await expect(modal).not.toContainText(/Admin Final Purpose Policy|Policy version:|Pending thresholds|organization precedence/i);
  await expect(modal.getByRole("button", { name: /Change Requirements/i })).toHaveCount(0);
}
test("Staff review stays independent and automatic Admin approval records an unresolved Other-purpose policy as pending", async ({ page }) => {
  let request = { ...ownRequest("Pending", "citizen-requester"), purposePolicyManaged: true, purpose: "Habitat activity", purposePolicyCandidate: { purpose: "Other", policyVersion: 0 }, workflow: { ...ownRequest().workflow, purpose: "Other", purposeOther: "Habitat activity" } };
  let reviewed = false, approvalAttempts = 0;
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }),
    "PATCH /api/seedling-requests/staff-own-request/review": (route, req) => { expect(req.postDataJSON()).not.toHaveProperty("policyProposal"); reviewed = true; request = { ...request, status: "Reviewed", requestVersion: 4 }; return route.fulfill({ json: { success: true, data: request } }); },
    "PATCH /api/seedling-requests/staff-own-request/approve": (route, req) => {
      approvalAttempts++; expect(req.postDataJSON()).toEqual({ expectedVersion: 4 });
      request = { ...request, status: "Approved", requestVersion: 5, approvedPurposePolicy: { policyStatus: "PENDING_MENRO_POLICY", pendingReasons: ["OTHER_PURPOSE", "CONDITIONAL_THRESHOLD_PENDING"], definition: { reporting: "PENDING_MENRO_POLICY", monitoring: "PENDING_MENRO_POLICY" }, override: null, source: "ADMIN_APPROVED_REQUEST_POLICY_PENDING" } };
      return route.fulfill({ json: { success: true, data: request } });
    } });
  await page.goto("/staff/requests?role=staff"); await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click(); await page.getByRole("button", { name: "Review", exact: true }).click();
  const review = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Review Seedling Request", exact: true }) }); await expect(review).toBeVisible(); await expect(review.getByText(/Staff Policy Proposal|Reporting Requirement|Monitoring Requirement|Reason for Policy/)).toHaveCount(0);
  await review.getByRole("button", { name: "Complete Review", exact: true }).click(); await expect(review).toHaveCount(0); expect(reviewed).toBe(true);
  await page.goto("/admin/requests?role=admin"); await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click(); await page.getByRole("button", { name: "Approve", exact: true }).click();
  const modal = page.locator(".sr-decision-modal"); await expectAutomaticApproval(modal);
  await modal.getByRole("button", { name: "Confirm Approval", exact: true }).click(); await expect(modal).toHaveCount(0);
  await expect(page.getByText("Pending MENRO policy decision", { exact: true })).toBeVisible();
  expect(approvalAttempts).toBe(1); expect(request.status).toBe("Approved"); expect(request.approvedPurposePolicy.override).toBeNull(); fixture.check();
});

const automaticApprovalScenarios = [
  { label: "unmanaged", managed: false, purpose: "Household / Backyard" },
  { label: "managed", managed: true, purpose: "Household / Backyard", definition: { reporting: "NOT_REQUIRED", monitoring: "STAFF_SPOT_CHECK", quantityThreshold: null } },
  { label: "conditional threshold configured", managed: true, purpose: "Agroforestry / Fruit Tree", definition: { reporting: "CONDITIONAL", monitoring: "NONE", quantityThreshold: 50 } },
  { label: "organization configured", managed: true, purpose: "Household / Backyard", sector: "Government Agency", definition: { reporting: "REQUIRED", monitoring: "PERMANENT_SAMPLE", quantityThreshold: null } },
];
for (const scenario of automaticApprovalScenarios) test(`Admin automatic approval preserves request details and schedules (${scenario.label})`, async ({ page }) => {
  let request = { ...ownRequest("Reviewed", "citizen-requester"), purposePolicyManaged: scenario.managed, purpose: scenario.purpose,
    purposePolicyCandidate: { purpose: scenario.purpose, policyVersion: 0 }, workflow: { ...ownRequest().workflow, purpose: scenario.purpose, ...(scenario.sector ? { sector: scenario.sector } : {}) } };
  let approved;
  const fixture = await setup(page, {
    "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }),
    "PATCH /api/seedling-requests/staff-own-request/approve": (route, req) => {
      approved = req.postDataJSON(); request = { ...request, status: "Approved", requestVersion: 4,
        ...(scenario.managed ? { approvedPurposePolicy: { policyVersion: 5, definition: scenario.definition, override: null, approvedBy: "test-admin", source: "ADMIN_APPROVED_PURPOSE_POLICY" } } : {}) };
      return route.fulfill({ json: { success: true, data: request } });
    },
  });
  await page.goto("/admin/requests?role=admin"); await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click(); await page.getByRole("button", { name: "Approve", exact: true }).click();
  const modal = page.locator(".sr-decision-modal");
  await expect(modal.getByRole("heading", { name: "Approve Seedling Request", exact: true })).toBeVisible(); await expectAutomaticApproval(modal);
  await expect(modal.locator(".sr-decision-request-summary")).toContainText("REQ-2099-001");
  for (const label of ["Purpose", "Original Planting Date", "Confirmed Planting Date", "Requester Confirmation", "Schedule Status"]) await expect(modal.getByText(label, { exact: true })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
  await modal.screenshot({ path: test.info().outputPath(`automatic-approval-${scenario.label.replaceAll(" ", "-")}.png`) });
  await modal.getByRole("button", { name: "Confirm Approval", exact: true }).click(); await expect(modal).toHaveCount(0);
  expect(approved).toEqual({ expectedVersion: 3 }); expect(request.status).toBe("Approved");
  if (scenario.managed) expect(request.approvedPurposePolicy).toMatchObject({ definition: scenario.definition, override: null }); fixture.check();
});

for (const scenario of [
  { label: "missing quantity threshold", purpose: "Agroforestry / Fruit Tree", sector: "Resident / Individual", pendingReasons: ["CONDITIONAL_THRESHOLD_PENDING"] },
  { label: "unresolved organization rule", purpose: "Household / Backyard", sector: "Government Agency", pendingReasons: ["ORGANIZATION_POLICY_PENDING"] },
]) test(`Admin automatic approval records pending MENRO policy for ${scenario.label}`, async ({ page }) => {
  let request = { ...ownRequest("Reviewed", "citizen-requester"), purposePolicyManaged: true, purpose: scenario.purpose,
    workflow: { ...ownRequest().workflow, purpose: scenario.purpose, sector: scenario.sector } };
  const originalSchedule = structuredClone(request.originalSchedule); let attempts = 0;
  const fixture = await setup(page, {
    "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }),
    "PATCH /api/seedling-requests/staff-own-request/approve": (route, req) => { attempts++; expect(req.postDataJSON()).toEqual({ expectedVersion: 3 });
      request = { ...request, status: "Approved", requestVersion: 4, approvedPurposePolicy: { policyStatus: "PENDING_MENRO_POLICY", pendingReasons: scenario.pendingReasons, definition: { reporting: "PENDING_MENRO_POLICY", monitoring: "PENDING_MENRO_POLICY" }, override: null } };
      return route.fulfill({ json: { success: true, data: request } }); },
  });
  await page.goto("/admin/requests?role=admin"); await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click(); await page.getByRole("button", { name: "Approve", exact: true }).click();
  const modal = page.locator(".sr-decision-modal"); await expectAutomaticApproval(modal); await modal.getByRole("button", { name: "Confirm Approval", exact: true }).click();
  await expect(modal).toHaveCount(0); await expect(page.getByText("Pending MENRO policy decision", { exact: true })).toBeVisible();
  expect(attempts).toBe(1); expect(request.status).toBe("Approved"); expect(request.originalSchedule).toEqual(originalSchedule); fixture.check();
});

test("automatic approval surfaces a policy validation failure without permanently locking the decision", async ({ page }) => {
  let request = { ...ownRequest("Reviewed", "citizen-requester"), purposePolicyManaged: true }, attempts = 0;
  const fixture = await setup(page, {
    "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }),
    "PATCH /api/seedling-requests/staff-own-request/approve": (route, req) => {
      expect(req.postDataJSON()).toEqual({ expectedVersion: 3 }); attempts++;
      if (attempts === 1) return route.fulfill({ status: 409, json: { success: false, message: "Policy validation changed.", fieldErrors: { policyReason: "Refresh policy metadata." } } });
      request = { ...request, status: "Approved", requestVersion: 4, approvedPurposePolicy: { policyStatus: "PENDING_MENRO_POLICY", definition: { reporting: "PENDING_MENRO_POLICY", monitoring: "PENDING_MENRO_POLICY" }, override: null } };
      return route.fulfill({ json: { success: true, data: request } });
    },
  });
  await page.goto("/admin/requests?role=admin"); await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click(); await page.getByRole("button", { name: "Approve", exact: true }).click();
  const modal = page.locator(".sr-decision-modal"), confirm = modal.getByRole("button", { name: "Confirm Approval", exact: true }); await expectAutomaticApproval(modal); await confirm.click();
  await expect(modal.getByRole("alert")).toHaveText("Approval requirements could not be validated. Refresh the request and try again. No approval was saved.");
  await expect(confirm).toBeEnabled(); expect(attempts).toBe(1); expect(request.status).toBe("Reviewed");
  await confirm.click(); await expect(modal).toHaveCount(0); expect(attempts).toBe(2); fixture.check();
});

for (const failure of [
  { label: "stale request", status: 409, message: "The request has changed. Refresh and try again." },
  { label: "service unavailable", status: 503, message: "Approval is temporarily unavailable. Please try again." },
  { label: "authorization denied", status: 403, message: "Admin access is required." },
]) test(`Admin automatic approval does not retry or save after ${failure.label}`, async ({ page }) => {
  const request = { ...ownRequest("Reviewed", "citizen-requester"), purposePolicyManaged: true };
  let attempts = 0;
  const fixture = await setup(page, {
    "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }),
    "PATCH /api/seedling-requests/staff-own-request/approve": (route, req) => { attempts++; expect(req.postDataJSON()).toEqual({ expectedVersion: 3 }); return route.fulfill({ status: failure.status, json: { success: false, message: failure.message } }); },
  });
  await page.goto("/admin/requests?role=admin"); await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click(); await page.getByRole("button", { name: "Approve", exact: true }).click();
  const modal = page.locator(".sr-decision-modal"); await expectAutomaticApproval(modal); await modal.getByRole("button", { name: "Confirm Approval", exact: true }).click();
  await expect(modal.getByRole("alert")).toHaveText(failure.message); await expect(modal.getByRole("button", { name: "Confirm Approval", exact: true })).toBeEnabled();
  expect(attempts).toBe(1); expect(request.status).toBe("Reviewed"); fixture.check();
});

test("automatic approval remains inaccessible to Staff, Participant and unauthenticated users", async ({ page }) => {
  const fixture = await setup(page);
  for (const role of ["staff", "participant", "unauthenticated"]) {
    await page.goto(`/admin/requests?role=${role}`); await expect(page).not.toHaveURL(/\/admin\/requests/);
    await expect(page.getByRole("button", { name: "Confirm Approval", exact: true })).toHaveCount(0);
  }
  expect(fixture.calls.filter(call => call.key.endsWith("/approve"))).toHaveLength(0); fixture.check();
});

test("Staff assisted identity is the only new request mode and starts blank", async ({ page }) => {
  const fixture = await setup(page);
  await page.goto("/staff/request-seedlings?role=staff");
  await expect(page.getByRole("radio", { name: "For a Requester", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Assisted By", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Assisted By Staff *", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Full Name *", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Full Name *", { exact: true })).not.toHaveAttribute("readonly");
  await expect(page.getByLabel("Contact Number *", { exact: true })).not.toHaveAttribute("readonly"); fixture.check();
});

test("My Requests ownership filter combines with Replacement and includes walk-ins this Staff encoded, never another Staff member's", async ({ page }) => {
  const records = [
    { ...ownRequest(), id: "mine-new", requestNumber: "REQ-2099-101", requestType: "New Planting" },
    { ...ownRequest(), id: "mine-replacement", requestNumber: "REQ-2099-102", requestType: "Replacement" },
    { ...ownRequest("Pending", "citizen"), id: "assisted", requestNumber: "REQ-2099-103", requestType: "Replacement", walkIn: { encodedBy: "test-staff" } },
    { ...ownRequest("Pending", "other-citizen"), id: "assisted-by-other", requestNumber: "REQ-2099-104", requestType: "Replacement", walkIn: { encodedBy: "another-staff" } },
  ];
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: records } }) });
  await page.goto("/staff/requests?role=staff");
  await expect(page.getByRole("button", { name: "Encode Walk-in Request", exact: true })).toHaveCount(0);
  await expect(page.locator(".sr-header-actions").getByRole("button", { name: "My Requests", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "My Requests", exact: true }).check();
  await expect(page.getByRole("button", { name: "View details for REQ-2099-103", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "View details for REQ-2099-104", exact: true })).toHaveCount(0);
  await page.locator("select").filter({ has: page.locator('option[value="Replacement"]') }).selectOption("Replacement");
  await expect(page.getByRole("button", { name: "View details for REQ-2099-102", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "View details for REQ-2099-103", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "View details for REQ-2099-101", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "My Requests", exact: true }).uncheck();
  await page.getByRole("button", { name: "View details for REQ-2099-103", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review", exact: true })).toHaveCount(0); fixture.check();
});

test("official auto-fill starts clean and explains genuinely missing coordinates without inventing them", async ({ page }) => {
  const fixture = await setup(page, { "GET /api/planting-reports/official/options": route => route.fulfill({ json: { success: true, data: { options: [{ ...releaseOption, latitude: null, participantSector: "" }], nextCursor: null } } }) });
  await page.goto("/staff/planting-reports?role=staff"); await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  await expect(page.getByLabel("Requester Full Name", { exact: true })).toHaveAttribute("placeholder", "Auto-filled after selecting a released request");
  await expect(page.getByText(/Missing authoritative record data/)).toHaveCount(0);
  await page.getByLabel("Seedling Release Record *").selectOption("released-request");
  await expect(page.getByLabel("Site Latitude", { exact: true })).toHaveValue("Not recorded");
  await expect(page.getByLabel("Participant Sector", { exact: true })).toHaveValue("Not recorded");
  await expect(page.getByText(/Required information not recorded: site coordinates/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Take Photo", exact: true })).toBeDisabled(); fixture.check();
});

for (const width of [390, 1440]) test(`Staff dashboard preserves cards without reporting block at ${width}px`, async ({ page }) => {
  const request = { ...ownRequest("Released"), reportingPolicy: { reporting: "REQUIRED" }, releasedItems: [{ releasedQuantity: 10 }] };
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }) });
  await page.setViewportSize({ width, height: 900 }); await page.goto("/staff/dashboard?role=staff");
  await expect(page.locator(".dashboard-kpi-grid")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planting Confirmation and Reporting Coverage" })).toHaveCount(0);
  const overflow = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll("body *")].map(node => ({ tag: node.tagName, cls: node.className?.baseVal ?? node.className, right: node.getBoundingClientRect().right, width: node.getBoundingClientRect().width })).filter(row => row.right > window.innerWidth + 1).slice(0, 20) }));
  await page.screenshot({ path: test.info().outputPath(`staff-dashboard-${width}.png`) });
  expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width);
  await page.screenshot({ path: test.info().outputPath(`staff-dashboard-${width}.png`) }); fixture.check();
});

const cohortAccessFixture = { id: "VPC-fixture", verifiedPlantedQuantity: 10, source: { plantingReportId: "report-1", siteId: "site-1" }, samplingPolicySnapshot: { percentage: 10 }, samplingReadiness: { target: null, pending: ["approved minimum"] }, samplingPlan: { status: "DRAFT", version: 0 } };
// Approved (non-parent, workflowStatus Completed) report linked to cohortAccessFixture.
const approvedCohortReport = { id: "report-1", reportNumber: "RPT-2099-001", workflowStatus: "Completed", participantName: "Fixture Requester", siteId: "site-1", siteName: "Fixture Site", barangay: "Bical", quantityPlanted: 10, photos: [] };
const otherCohortFixture = { ...cohortAccessFixture, id: "VPC-other", source: { plantingReportId: "report-other", siteId: "site-2" } };
// Actual readiness response shape from GET /verified-sample-monitoring/readiness (production keeps visit creation blocked).
const cohortReadinessFixture = { cohorts: [{ cohortId: "VPC-fixture", reportNumber: "RPT-2099-001", siteName: "Fixture Site", canCreateVisit: false, reasons: [
  { code: "SAMPLING_POLICY_PENDING", pending: ["MINIMUM_SAMPLE_POLICY_PENDING"] }, { code: "SAMPLING_PLAN_NOT_APPROVED", planStatus: "DRAFT" },
  { code: "BASELINE_NOT_APPROVED", baselineStatus: "NOT_STARTED" }, { code: "VISIT_SCHEDULING_POLICY_PENDING" }] }], truncated: false, visitCreationAvailable: false, schedulingPolicyStatus: "PENDING_MENRO_APPROVAL" };
const cohortRoutes = (reports = [approvedCohortReport]) => ({
  "GET /api/verified-planting-cohorts": route => route.fulfill({ json: { success: true, data: [otherCohortFixture, cohortAccessFixture] } }),
  "GET /api/verified-sample-monitoring/readiness": route => route.fulfill({ json: { success: true, data: cohortReadinessFixture } }),
  "GET /api/planting-reports": route => route.fulfill({ json: { success: true, data: reports } }),
  ...Object.fromEntries(reports.flatMap(report => [
    [`GET /api/planting-reports/${report.id}`, route => route.fulfill({ json: { success: true, data: report } })],
    [`GET /api/planting-reports/${report.id}/verification-logs`, route => route.fulfill({ json: { success: true, data: [] } })],
  ])),
});
async function openReportsCohort(page, role) {
  await page.goto(`/${role}/planting-reports?role=${role}`);
  // No page-level sampling/baseline panel on the main Planting Reports layout.
  await expect(page.getByRole("button", { name: "Verified Planting Cohorts", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Verified cohort", { exact: true })).toHaveCount(0);
  await page.goto(`/${role}/planting-reports?role=${role}&report=report-1`);
  const drawer = page.getByRole("dialog", { name: /Planting report/ });
  await drawer.getByRole("button", { name: "View sampling plan and baseline", exact: true }).click();
  await expect(drawer.getByRole("heading", { name: "Permanent Sample Setup", exact: true })).toBeVisible();
  // Only this report's cohort is shown and preselected; no cross-report selector.
  await expect(drawer.getByLabel("Verified cohort", { exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("heading", { name: "Verified planting record", exact: true })).toBeVisible();
  // The cohort ID appears in the setup panel and in the read-only Monitoring Status section.
  await expect(drawer.locator("#pr-sample-setup-panel").getByText(cohortAccessFixture.id, { exact: true })).toBeVisible();
  await expect(drawer.locator("section.pr-monitoring-status").getByText(cohortAccessFixture.id, { exact: true })).toBeVisible();
  await expect(drawer.getByText(otherCohortFixture.id)).toHaveCount(0);
  await expect(drawer.getByRole("link", { name: "View registered planting site", exact: true })).toHaveAttribute("href", "/" + role + "/planting-sites?site=site-1");
  return drawer;
}

test("staff manages sampling plans and baselines inside the approved report's details, not a page panel or Survival Monitoring", async ({ page }) => {
  const fixture = await setup(page, cohortRoutes());
  await openReportsCohort(page, "staff");
  await expect(page.getByRole("heading", { name: "Sampling Plan", exact: true })).toBeVisible();
  await expect(page.getByText(/MENRO decisions pending: approved minimum/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit plan for approval", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Create Visit/ })).toHaveCount(0);
  await expect(page.getByText(/to manage eligible permanent samples and baseline records/)).toHaveCount(0);
  await page.getByRole("button", { name: "Close planting report details", exact: true }).click();
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await expect(page.getByRole("link", { name: "Verified Planting Records", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Permanent Sample Monitoring", exact: true, includeHidden: true })).toHaveCount(0);
  await page.goto("/staff/survival-monitoring?role=staff");
  await expect(page.getByRole("heading", { name: "Survival Monitoring", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Permanent Sample Selection and Baselines", exact: true })).toHaveCount(0);
  fixture.check();
});

test("admin reviews plan/baseline readiness inside the approved report's details, not in Survival Monitoring", async ({ page }) => {
  // Admin Survival Monitoring reads the read-only permanent-sample visit list for its Monitoring Records rows.
  const fixture = await setup(page, { ...cohortRoutes(), "GET /api/verified-sample-monitoring/visits": route => route.fulfill({ json: { success: true, data: { visits: [], nextCursor: null, writesPaused: false } } }) });
  const drawer = await openReportsCohort(page, "admin");
  await expect(drawer.getByRole("heading", { name: "Sampling Plan", exact: true })).toBeVisible();
  await expect(drawer.getByText(/MENRO decisions pending: approved minimum/)).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Submit plan for approval", exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: /Save draft|Submit baseline for approval|Capture verified baseline photo/ })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Approve sampling plan", exact: true })).toHaveCount(0); // policy snapshot still pending
  await expect(drawer.getByRole("button", { name: /Create Visit/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Close planting report details", exact: true }).click();
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await expect(page.getByRole("link", { name: "Verified Planting Records", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Permanent Sample Monitoring", exact: true, includeHidden: true })).toHaveCount(0);
  await page.goto("/admin/survival-monitoring?role=admin");
  await expect(page.getByRole("heading", { name: "Survival Monitoring", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Permanent Sample Selection and Baselines", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Verified cohort", { exact: true })).toHaveCount(0);
  fixture.check();
});

test("admin approves a pending sampling plan from the report details using the existing approval endpoint", async ({ page }) => {
  const pendingPlan = { ...cohortAccessFixture, samplingPolicySnapshot: null, samplingReadiness: null, samplingPlan: { status: "PENDING_ADMIN_APPROVAL", version: 3, selectedSamples: [{ permanentId: "TREE-001", species: "Narra", siteReference: "Plot A", selectionReason: "Documented", unitType: "tree" }] } };
  const approvals = [];
  const fixture = await setup(page, { ...cohortRoutes(),
    "GET /api/verified-planting-cohorts": route => route.fulfill({ json: { success: true, data: [approvals.length ? { ...pendingPlan, samplingPlan: { ...pendingPlan.samplingPlan, status: "APPROVED", version: 4 } } : pendingPlan] } }),
    [`POST /api/verified-planting-cohorts/${cohortAccessFixture.id}/sampling-plan/approve`]: (route, request) => { approvals.push(request.postDataJSON()); return route.fulfill({ json: { success: true, data: {} } }); } });
  await page.goto("/admin/planting-reports?role=admin&report=report-1");
  const drawer = page.getByRole("dialog", { name: /Planting report/ });
  await drawer.getByRole("button", { name: "View sampling plan and baseline", exact: true }).click();
  await drawer.getByRole("button", { name: "Approve sampling plan", exact: true }).click();
  await expect(drawer.getByRole("status").filter({ hasText: "Sampling plan approved." })).toBeVisible();
  expect(approvals).toEqual([{ expectedVersion: 3, approve: true }]);
  fixture.check();
});


const monitoringStatusOf = drawer => drawer.locator("section.pr-monitoring-status");
const lookupCalls = fixture => fixture.calls.filter(call => ["GET /api/verified-planting-cohorts", "GET /api/verified-sample-monitoring/readiness"].includes(call.key));

for (const role of ["staff", "admin"]) test(role + " sees a read-only pending-MENRO-policy Monitoring Status for a Staff spot-check report, with no cohort lookup", async ({ page }) => {
  const spotCheck = { ...approvedCohortReport, reportingPolicy: { monitoring: "STAFF_SPOT_CHECK", reporting: "REQUIRED" } };
  const fixture = await setup(page, cohortRoutes([spotCheck]));
  await page.goto("/" + role + "/planting-reports?role=" + role + "&report=report-1");
  const status = monitoringStatusOf(page.getByRole("dialog", { name: /Planting report/ }));
  await expect(status.getByText("Monitoring Status", { exact: true })).toBeVisible();
  await expect(status).toContainText("Staff Spot-Check");
  await expect(status).toContainText("Monitoring workflow pending MENRO policy");
  await expect(status).not.toContainText("VPC-");
  await expect(status.getByRole("button")).toHaveCount(0);
  await expect(status.getByRole("link")).toHaveCount(0);
  expect(lookupCalls(fixture)).toEqual([]);
  fixture.check();
});

for (const role of ["staff", "admin"]) test(role + " sees the existing permanent-sample cohort with actual plan, baseline and visit-readiness status", async ({ page }) => {
  const permanent = { ...approvedCohortReport, reportingPolicy: { monitoring: "PERMANENT_SAMPLE", reporting: "REQUIRED" } };
  const fixture = await setup(page, cohortRoutes([permanent]));
  await page.goto("/" + role + "/planting-reports?role=" + role + "&report=report-1");
  const status = monitoringStatusOf(page.getByRole("dialog", { name: /Planting report/ }));
  await expect(status).toContainText("Permanent Sample Monitoring");
  await expect(status).toContainText("VPC-fixture");
  await expect(status).not.toContainText("VPC-other");
  await expect(status).toContainText("Sampling planDraft");
  await expect(status).toContainText("BaselineNot Started");
  await expect(status).toContainText("Not ready for a monitoring visit.");
  const reasons = status.getByRole("list", { name: "Why no monitoring visit is available" });
  await expect(reasons).toContainText("The MENRO sampling policy is incomplete: minimum sample size.");
  await expect(reasons).toContainText("New monitoring visits can start only after MENRO approves the visit scheduling policy.");
  await expect(status.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Create Visit|Approve Visit|Monitor Planted Trees/ })).toHaveCount(0);
  fixture.check();
});

test("permanent-sample report without a cohort says so and never invents a cohort ID or readiness", async ({ page }) => {
  const permanent = { ...approvedCohortReport, reportingPolicy: { monitoring: "PERMANENT_SAMPLE", reporting: "REQUIRED" } };
  const fixture = await setup(page, { ...cohortRoutes([permanent]),
    "GET /api/verified-planting-cohorts": route => route.fulfill({ json: { success: true, data: [otherCohortFixture] } }),
    "GET /api/verified-sample-monitoring/readiness": route => route.fulfill({ status: 403, json: { success: false, message: "Permanent-sample pilot access is unavailable." } }) });
  await page.goto("/admin/planting-reports?role=admin&report=report-1");
  const status = monitoringStatusOf(page.getByRole("dialog", { name: /Planting report/ }));
  await expect(status).toContainText("No permanent-sample cohort exists for this report.");
  await expect(status).not.toContainText("VPC-");
  await expect(status).not.toContainText("Ready for a monitoring visit");
  await expect(status.getByRole("button")).toHaveCount(0);
  fixture.check();
});

test("participant report details have no Monitoring Status and make no cohort or readiness requests", async ({ page }) => {
  const own = { ...approvedCohortReport, participantId: "test-participant", reportingPolicy: { monitoring: "PERMANENT_SAMPLE", reporting: "REQUIRED" } };
  const fixture = await setup(page, { ...cohortRoutes([own]), "GET /api/planting-reports/my-reports": route => route.fulfill({ json: { success: true, data: [own] } }) });
  await page.goto("/participant/my-planting-reports?role=participant&report=report-1");
  await expect(page.getByRole("dialog", { name: /Planting report/ })).toBeVisible();
  await expect(page.locator("section.pr-monitoring-status")).toHaveCount(0);
  await expect(page.getByText("Monitoring Status", { exact: true })).toHaveCount(0);
  expect(lookupCalls(fixture)).toEqual([]);
  fixture.check();
});

test("Participant evidence is invalidated on release, event and site changes", async ({ page }) => {
  let delayVerification = false, releaseVerification;
  const events = ["event-1", "event-2"].map(id => ({ id, name: id, type: "Tree Planting", plantingSiteId: site.id, sourceRequestId: "request-1", date: "2026-01-01", startTime: "08:00", status: "Approved", recordStatus: "Authorized" }));
  const distributions = ["release-1", "release-2", "release-3"].map((id, index) => ({ id, requestId: id, eventId: index === 2 ? "event-2" : "event-1", plantingSiteId: site.id, participantId: "test-participant", status: "Released", items: [{ inventoryId: "narra", species: "Narra", releasedQuantity: 10 }] }));
  const fixture = await setup(page, {
    "GET /api/events": route => route.fulfill({ json: { success: true, data: events } }),
    "GET /api/distributions/my-distributions": route => route.fulfill({ json: { success: true, data: distributions } }),
    "POST /api/evidence-capture-sessions": (route, request) => { expect(request.postDataJSON().siteId).toBe(site.id); return route.fulfill({ json: { success: true, data: { captureSessionId: "reset-session", nonce: "fixture-only" } } }); },
    "POST /api/evidence-capture-sessions/reset-session/verify": async route => { if (delayVerification) await new Promise(resolve => { releaseVerification = resolve; }); return route.fulfill({ json: { success: true, data: { verificationId: "verified", imageSha256: "fixture-only", location: { latitude: site.latitude, longitude: site.longitude, accuracy: 5 } } } }); },
  });
  await page.goto("/participant/my-planting-reports?role=participant");
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  await page.locator("#planting-barangay").selectOption("Bical"); await page.locator("#planting-siteId").selectOption(site.id);
  await page.locator("#planting-eventId").selectOption("event-1"); await page.locator("#planting-distributionId").selectOption("release-1");
  async function capture() { await page.getByRole("button", { name: "Take Photo", exact: true }).click(); await page.getByRole("button", { name: "Verify fixture camera photo" }).click(); await expect(page.getByText("Verified Browser Camera Evidence", { exact: true })).toBeVisible(); }
  async function cleared() { await expect(page.getByAltText("Planting evidence preview 1")).toHaveCount(0); await expect(page.getByText(/0 \/ 10 photos selected/)).toBeVisible(); }
  await capture(); await page.locator("#planting-distributionId").selectOption("release-2"); await cleared();
  await capture(); await page.locator("#planting-eventId").selectOption("event-2"); await cleared();
  await page.locator("#planting-distributionId").selectOption("release-3"); await capture(); await page.locator("#planting-siteId").selectOption(""); await cleared();
  await page.locator("#planting-siteId").selectOption(site.id); await page.locator("#planting-eventId").selectOption("event-1"); await page.locator("#planting-distributionId").selectOption("release-1");
  delayVerification = true;
  await page.getByRole("button", { name: "Take Photo", exact: true }).click(); await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
  await expect.poll(() => typeof releaseVerification).toBe("function");
  await page.getByRole("dialog", { name: "Secure camera capture", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click();
  await page.locator("#planting-distributionId").selectOption("release-2"); await page.getByRole("button", { name: "Take Photo", exact: true }).click();
  const oldResponse = page.waitForResponse(response => response.url().endsWith("/reset-session/verify"));
  releaseVerification(); await (await oldResponse).finished(); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByAltText("Planting evidence preview 1")).toHaveCount(0);
  await page.getByRole("dialog", { name: "Secure camera capture", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click(); fixture.check();
});

for (const width of [390, 1440]) test(`Staff photo/location sections match Participant layout at ${width}px`, async ({ page }) => {
  const fixture = await staffForm(page); await page.setViewportSize({ width, height: 900 });
  await expect(page.locator(".pr-photo-evidence-section")).toBeVisible(); await expect(page.locator(".pr-photo-location-section")).toBeVisible();
  await expect(page.getByRole("button", { name: "Take Photo", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Upload Existing Photos", exact: true })).toHaveCount(1);
  const metrics = await page.locator(".pr-photo-actions").evaluate(node => ({ align: getComputedStyle(node).justifyContent, right: node.getBoundingClientRect().right }));
  expect(metrics.align).toBe("center"); expect(metrics.right).toBeLessThanOrEqual(width);
  await expect(page.locator(".pr-photo-location-section .leaflet-control-zoom-in")).toBeVisible();
  await page.locator(".pr-photo-evidence-section").screenshot({ path: test.info().outputPath(`staff-evidence-${width}.png`) });
  await page.locator(".pr-photo-location-section").screenshot({ path: test.info().outputPath(`staff-location-${width}.png`) }); fixture.check();
});


test("disabled cohort gate hides integrated actions and preserves safe bookmarked-route denial", async ({ page }) => {
  const fixture = await setup(page); await page.addInitScript(() => { window.__PHASE3C_GATE_ENABLED__ = "false"; });
  await page.goto("/staff/planting-reports?role=staff"); await expect(page.getByRole("button", { name: "Verified Planting Cohorts", exact: true })).toHaveCount(0);
  await page.goto("/staff/survival-monitoring?role=staff"); await expect(page.getByRole("button", { name: "Permanent Sample Selection and Baselines", exact: true })).toHaveCount(0);
  await page.goto("/staff/verified-planting-cohorts?role=staff"); await expect(page.getByText("Verified planting cohort sampling is not available in this environment.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Verified cohort", { exact: true })).toHaveCount(0); fixture.check();
});

for (const role of ["admin", "staff", "participant"]) for (const width of [320, 360, 390, 430, 768, 1440]) test(role + " dashboard omits reporting coverage at " + width + "px", async ({ page }) => {
  const request = { ...ownRequest("Released", role === "participant" ? "test-participant" : "test-staff"), reportingPolicy: { reporting: "REQUIRED" }, releasedItems: [{ releasedQuantity: 10 }] };
  const fixture = await setup(page, Object.fromEntries(["/api/seedling-requests", "/api/seedling-requests/my", "/api/seedling-requests/my-requests"].map(path => ["GET " + path, route => route.fulfill({ json: { success: true, data: [request] } })])));
  await page.setViewportSize({ width, height: 900 }); await page.goto("/" + role + "/dashboard?role=" + role);
  await expect(page.locator(".dashboard-kpi-grid")).toBeVisible();
  await expect(page.locator(".reporting-coverage")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Planting Confirmation and Reporting Coverage", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Planting reporting coverage", exact: true })).toHaveCount(0);
  await expect(page.locator(".dashboard-filter-row")).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: test.info().outputPath(`dashboard-cleanup-${role}-${width}.png`), fullPage: true }); fixture.check();
});
test("approved report without a linked cohort states it truthfully and pending reports show no sample setup", async ({ page }) => {
  const unlinked = { ...approvedCohortReport, id: "report-unlinked", reportNumber: "RPT-2099-002" };
  const pending = { ...approvedCohortReport, id: "report-pending", reportNumber: "RPT-2099-003", workflowStatus: "Pending Review" };
  const fixture = await setup(page, cohortRoutes([unlinked, pending]));
  await page.goto("/staff/planting-reports?role=staff&report=report-unlinked");
  const drawer = page.getByRole("dialog", { name: /Planting report/ });
  await drawer.getByRole("button", { name: "View sampling plan and baseline", exact: true }).click();
  await expect(drawer.getByRole("status").filter({ hasText: "No verified planting cohort is linked to this report." })).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Sampling Plan", exact: true })).toHaveCount(0);
  await expect(drawer.getByText(/VPC-/)).toHaveCount(0);
  await page.goto("/staff/planting-reports?role=staff&report=report-pending");
  await expect(page.getByRole("dialog", { name: /Planting report/ }).getByText("Basic Information", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "View sampling plan and baseline", exact: true })).toHaveCount(0);
  fixture.check();
});

for (const [role, path, name] of [["staff", "/staff/planting-reports?role=staff&report=report-1", "View sampling plan and baseline"], ["admin", "/admin/planting-reports?role=admin&report=report-1", "View sampling plan and baseline"]])
test(`${role} sampling action wraps at 320px without clipping`, async ({ page }) => {
  await setup(page, cohortRoutes()); await page.setViewportSize({ width: 320, height: 900 }); await page.goto(path);
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toBeVisible();
  expect(await button.evaluate(node => node.getBoundingClientRect().right)).toBeLessThanOrEqual(320);
  expect(await button.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});

test("Staff photo verification shows the participant map and explains Take Photo before a release is selected", async ({ page }) => {
  const fixture = await setup(page, { "GET /api/planting-reports/official/options": route => route.fulfill({ json: { success: true, data: { options: [releaseOption], nextCursor: null } } }),
    "POST /api/evidence-capture-sessions": route => route.fulfill({ json: { success: true, data: { captureSessionId: "mock-session", nonce: "mock-nonce" } } }),
    "POST /api/evidence-capture-sessions/mock-session/verify": route => route.fulfill({ json: { success: true, data: { verificationId: "mock-verification", imageSha256: "mock-digest", location: { latitude: site.latitude, longitude: site.longitude, accuracy: 12 } } } }) });
  await page.goto("/staff/planting-reports?role=staff");
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  const map = page.locator(".pr-official-dialog .pr-location-map"), status = page.locator(".pr-official-dialog .pr-location-status");
  await expect(map).toBeVisible();
  await expect(status).toHaveText("Select a registered planting site first.");
  await expect(page.getByText(/Authoritative registered-site coordinates are required/)).toHaveCount(0);
  await page.getByRole("button", { name: "Take Photo", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Select a released request before adding planting photos." })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Secure planting camera", exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Seedling Release Record *" }).selectOption("released-request");
  await expect(status).toHaveText("Upload or take a photo first.");
  await expect(map.locator(".pr-map-barangay-label").filter({ hasText: "Bical" })).toBeVisible();
  await expect(map.locator(".leaflet-tile-pane img").first()).toBeAttached();
  await page.getByRole("button", { name: "Reminder", exact: true }).click();
  await page.getByRole("button", { name: "I Understand — Take Photo", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
  await expect(status).toHaveText(/Within registered site coverage/);
  const details = page.locator(".pr-official-dialog .pr-gps-captured");
  await expect(details.getByText("Distance from Site", { exact: true })).toBeVisible();
  await expect(details.getByText("12.0 m", { exact: true })).toBeVisible();
  await expect(details.getByText("Configured radius (50 m)", { exact: true })).toBeVisible();
  await expect(details.getByText("Valid", { exact: true })).toBeVisible();
  fixture.check();
});

const remarksStyle = locator => locator.evaluate(node => { const style = getComputedStyle(node); return { border: style.borderTopColor, padding: style.padding, fontSize: style.fontSize, lineHeight: style.lineHeight, minHeight: style.minHeight, placeholder: node.placeholder }; });

test("Staff report headings, remarks and attendance match the Participant form", async ({ page }) => {
  const fixture = await staffForm(page);
  await expect(page.getByText(/Original uploads require readable EXIF GPS/)).toHaveCount(0);
  for (const name of ["Planting Photo Evidence", "Photo Location Verification"]) {
    const heading = page.getByRole("heading", { name, exact: true });
    const layout = await heading.evaluate(node => { const icon = node.querySelector("svg").getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(node.lastChild); const text = range.getBoundingClientRect(); return { beside: icon.right <= text.left, centerGap: Math.abs((icon.top + icon.bottom) / 2 - (text.top + text.bottom) / 2) }; });
    expect(layout.beside).toBe(true); expect(layout.centerGap).toBeLessThanOrEqual(2);
  }
  await expect(page.locator(".pr-official-dialog .pr-report-additional-section .pr-section-header svg")).toHaveCount(1);
  const mapFit = await page.locator(".pr-official-dialog .pr-location-map").evaluate(node => node.closest(".pr-location-map-wrap").clientHeight - node.clientHeight);
  expect(mapFit).toBe(0);
  const attendanceGap = async () => page.locator(".attendance-upload").evaluate(node => node.querySelector(".attendance-dropzone").getBoundingClientRect().top - node.querySelector("label").getBoundingClientRect().bottom);
  const staffAttendanceGap = await attendanceGap();
  const staffRemarks = await remarksStyle(page.getByLabel("Remarks", { exact: true }));
  const staffLabel = await page.locator(".pr-official-dialog label.pr-label").evaluate(node => getComputedStyle(node).fontSize);
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.goto("/participant/my-planting-reports?role=participant");
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  expect(staffRemarks).toEqual(await remarksStyle(page.locator("textarea.pr-textarea")));
  expect(staffLabel).toBe(await page.locator("label[for='planting-remarks']").evaluate(node => getComputedStyle(node).fontSize));
  const body = page.locator(".pr-submit-modal-body"), attendance = body.locator(".attendance-upload");
  await expect(attendance).toHaveCount(1);
  expect(staffAttendanceGap).toBe(await attendanceGap());
  const edges = async locator => locator.evaluate(node => { const box = node.getBoundingClientRect(); return { left: box.left, right: box.right }; });
  expect(await edges(attendance)).toEqual(await edges(page.locator(".pr-report-additional-section")));
  fixture.check();
});

const calendarEvent = { id: "event-1", eventId: "EVT-2099-001", type: "Tree Planting", title: "Fixture planting", eventName: "Fixture planting", date: "2099-01-02", startTime: "08:00", endTime: "10:00", status: "Upcoming", plantingSiteId: "site-1", siteName: "Fixture site", barangay: "Bical" };
for (const [role, canAuthor] of [["staff", false], ["admin", true]]) test(`${role} event calendar ${canAuthor ? "keeps" : "removes"} manual add and edit`, async ({ page }) => {
  const fixture = await setup(page, { "GET /api/events": route => route.fulfill({ json: { success: true, data: [calendarEvent] } }) });
  await page.goto(`/${role}/event-calendar?role=${role}&event=event-1`);
  await expect(page.getByText("Total Events", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Event", exact: true })).toHaveCount(canAuthor ? 1 : 0);
  await expect(page.locator(".ec-details-footer").getByRole("button", { name: "Close", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit event", exact: true })).toHaveCount(canAuthor ? 1 : 0);
  await expect(page.locator(".ec-event-menu-btn")).toHaveCount(1);
  fixture.check();
});

for (const width of [390, 1440]) test(`Admin dashboard has no reporting coverage block or gap at ${width}px`, async ({ page }) => {
  const request = { ...ownRequest("Released"), reportingPolicy: { reporting: "REQUIRED" }, releasedItems: [{ releasedQuantity: 10 }] };
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }) });
  await page.setViewportSize({ width, height: 900 }); await page.goto("/admin/dashboard?role=admin");
  await expect(page.locator(".dashboard-kpi-grid")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planting Confirmation and Reporting Coverage" })).toHaveCount(0);
  await expect(page.locator(".reporting-coverage")).toHaveCount(0);
  await expect(page.locator(".admin-dashboard > .dashboard-filter-row")).toBeVisible();
  const firstIsFilters = await page.locator(".admin-dashboard").evaluate(node => node.firstElementChild.classList.contains("dashboard-filter-row"));
  expect(firstIsFilters).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  fixture.check();
});

const requesterFields = [
  ["Resident / Individual", null],
  ["Barangay Official", "Position in Barangay *"],
  ["Student (Individual)", "School Name *"],
  ["School Organization Representative", "School / Organization Name *"],
  ["Private Sector / Business", "Business / Company Name *"],
  ["Civic Organization / NGO", "Organization Name *"],
  ["Government Agency", "Government Agency / Office Name *"],
  ["Other (please specify)", "Specify Requester Type *"],
];
for (const [role, path] of [["participant", "/participant/request-seedlings?role=participant"], ["staff", "/staff/request-seedlings?role=staff"]]) test(`${role} form shows only the typed field for each Requesting As`, async ({ page }) => {
  const fixture = await setup(page); await page.goto(path);
  const sector = page.getByLabel("Requesting As *", { exact: true });
  await expect(sector).toBeVisible();
  const labels = requesterFields.map(([, label]) => label).filter(Boolean);
  for (const [value, label] of requesterFields) {
    await sector.selectOption(value);
    for (const other of labels) await expect(page.getByLabel(other, { exact: true })).toHaveCount(other === label ? 1 : 0);
    await expect(page.getByLabel("Representative Full Name")).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Group / Organization", exact: true })).toHaveCount(0);
    if (label) {
      const input = page.getByLabel(label, { exact: true });
      expect(await input.evaluate(node => [node.tagName, node.type])).toEqual(["INPUT", "text"]);
      await expect(input).toHaveValue(""); await input.fill("Typed value"); await expect(input).toHaveValue("Typed value");
    }
  }
  fixture.check();
});

test("Requesting As fields are required and shown as errors on the same step", async ({ page }) => {
  const fixture = await setup(page); await page.goto("/participant/request-seedlings?role=participant");
  await page.getByLabel("Requesting As *", { exact: true }).selectOption("Barangay Official");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Enter the Position in Barangay.", { exact: true })).toBeVisible();
  await page.getByLabel("Requesting As *", { exact: true }).selectOption("Resident / Individual");
  await expect(page.getByText("Enter the Position in Barangay.", { exact: true })).toHaveCount(0); fixture.check();
});

for (const [sector, detail, key, requestingAs] of [
  ["Student (Individual)", { label: "School Name *", value: "  Bulan National High School " }, "schoolName", ""],
  ["Other (please specify)", { label: "Specify Requester Type *", value: "Farmer Cooperative" }, "sectorOther", "individual"],
]) test(`${sector} saves only its typed requester value`, async ({ page }) => {
  const fixture = await setup(page); await requester(page, { sector, detail }); await plantingDetails(page);
  await expect(page.getByText(detail.value.trim(), { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Submit Request", exact: true }).click();
  await expect(page).toHaveURL(/participant\/my-requests/);
  const { workflow } = fixture.calls.find(call => call.key === "POST /api/seedling-requests").body;
  expect(workflow[key]).toBe(detail.value.trim()); expect(workflow.sector).toBe(sector); expect(workflow.requestingAs).toBe(requestingAs);
  for (const other of ["positionInBarangay", "schoolName", "organizationName", "sectorOther"].filter(field => field !== key)) expect(workflow[other]).toBe("");
  fixture.check();
});

const noExifImage = { name: "no-exif.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64") };
async function participantEvidenceForm(page, overrides = {}) {
  const event = { id: "event-1", name: "event-1", type: "Tree Planting", plantingSiteId: site.id, sourceRequestId: "request-1", date: "2026-01-01", startTime: "08:00", status: "Approved", recordStatus: "Authorized" };
  const release = { id: "release-1", requestId: "release-1", eventId: "event-1", plantingSiteId: site.id, participantId: "test-participant", status: "Released", items: [{ inventoryId: "narra", species: "Narra", releasedQuantity: 5, quantity: 5 }] };
  const fixture = await setup(page, {
    "GET /api/events": route => route.fulfill({ json: { success: true, data: [event] } }),
    "GET /api/distributions/my-distributions": route => route.fulfill({ json: { success: true, data: [release] } }),
    "POST /api/evidence-capture-sessions": route => route.fulfill({ json: { success: true, data: { captureSessionId: "mixed-session", nonce: "fixture-only" } } }),
    "POST /api/evidence-capture-sessions/mixed-session/verify": route => route.fulfill({ json: { success: true, data: { verificationId: "verified", imageSha256: "digest", location: { latitude: site.latitude, longitude: site.longitude, accuracy: 12 } } } }),
    ...overrides,
  });
  await page.goto("/participant/my-planting-reports?role=participant");
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  await page.locator("#planting-barangay").selectOption("Bical"); await page.locator("#planting-siteId").selectOption(site.id);
  await page.locator("#planting-eventId").selectOption("event-1"); await page.locator("#planting-distributionId").selectOption("release-1");
  return fixture;
}
const takeFixturePhoto = async page => { await page.getByRole("button", { name: "Take Photo", exact: true }).click(); await page.getByRole("button", { name: "Verify fixture camera photo" }).click(); };
const uploadFailure = page => page.locator(".pr-preview-verification strong").filter({ hasText: "Verification Failed — No GPS Metadata" });
const cameraEvidence = page => page.locator(".pr-preview-verification strong").filter({ hasText: "Verified Browser Camera Evidence" });

async function reportIdentity(page) {
  await page.locator("#planting-submittedByName").fill("Fixture requester");
  await page.locator("#planting-submittedBySector").selectOption("Volunteer");
  await page.locator("#planting-submittedByContactNumber").fill("09123456789");
}

test("Staff GPS errors remain in Location Verification and receive focus on Submit", async ({ page }) => {
  const fixture = await staffForm(page);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.locator(".pr-official-dialog input[type=file].pr-file-input").setInputFiles(noExifImage);
  await page.getByRole("button", { name: "Verify Photo Location", exact: true }).click();
  const card = page.getByRole("group", { name: "Location Verification", exact: true });
  await expect(card.getByRole("alert")).toContainText("no-exif.png has no GPS metadata");
  const precise = await card.getByRole("alert").textContent();
  await page.evaluate(() => {
    window.__errorScroll = [];
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(options) { window.__errorScroll.push(options); return scroll.call(this, options); };
  });
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(card.getByRole("alert")).toHaveText(precise);
  await expect(card).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__errorScroll.some(options => options?.behavior === "smooth"))).toBe(true);
  expect(fixture.calls.some(call => call.key === "POST /api/planting-reports/official")).toBe(false);
  fixture.check();
});

test("Participant Submit guard retains specific photo errors while GPS keeps the button blocked", async ({ page }) => {
  const fixture = await participantEvidenceForm(page);
  await reportIdentity(page); await takeFixturePhoto(page);
  await expect(cameraEvidence(page)).toHaveCount(1);
  await page.locator("#planting-photos").setInputFiles(noExifImage);
  await expect(uploadFailure(page)).toHaveCount(1);
  const submit = page.getByRole("button", { name: "Submit Report", exact: true });
  await expect(submit).toBeDisabled();
  // Exercise the form's defensive Submit validation too; the normal button
  // remains disabled by the existing GPS rule throughout this invalid case.
  const form = page.locator("form").filter({ has: page.locator("#planting-photos") });
  await form.evaluate(node => node.requestSubmit());
  const error = page.locator("#planting-photos-error");
  await expect(error).toContainText(/GPS|geotagged/i);
  const precise = await error.textContent();
  await expect(page.getByRole("button", { name: "Take Photo", exact: true })).toBeFocused();
  await form.evaluate(node => node.requestSubmit());
  await expect(error).toHaveText(precise);
  await expect(submit).toBeDisabled();
  expect(fixture.calls.some(call => call.key === "POST /api/planting-reports")).toBe(false);
  fixture.check();
});

test("Staff preserves a meaningful backend 503 before a report is saved", async ({ page }) => {
  const message = "Evidence storage is temporarily paused. Please try again later.";
  const fixture = await staffForm(page, { "POST /api/planting-reports/official": route => route.fulfill({ status: 503, json: { success: false, message } }) });
  await page.getByLabel("Confirmation Basis").selectOption("release-based");
  await page.evaluate(() => {
    window.__newErrorScrolls = [];
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(options) {
      if (this.matches(".pr-official-form-error")) window.__newErrorScrolls.push(this.textContent);
      return scroll.call(this, options);
    };
  });
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__newErrorScrolls)).toEqual([message]);
  await expect(page.getByText(/^Report saved — retry evidence\./)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit for Admin Verification" })).toBeEnabled();
  fixture.check();
});

test("Participant preserves a meaningful backend 503 without claiming a saved report", async ({ page }) => {
  const message = "Private photo storage is temporarily unavailable. Retry later.";
  let attempts = 0, release;
  const fixture = await participantEvidenceForm(page, { "POST /api/planting-reports": async route => {
    if (++attempts === 1) return route.fulfill({ status: 503, json: { success: false, message } });
    await new Promise(resolve => { release = resolve; });
    return route.fulfill({ status: 201, json: { success: true, message: "Awaiting MENRO Staff verification.", data: { id: "saved-participant-report" } } });
  } });
  await reportIdentity(page); await takeFixturePhoto(page);
  await page.getByRole("button", { name: "Submit Report", exact: true }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Report", exact: true })).toBeEnabled();
  await expect(page.getByText(/Your report is already saved pending/)).toHaveCount(0);
  await page.getByRole("button", { name: "Submit Report", exact: true }).click();
  await expect(page.getByRole("button", { name: "Submitting...", exact: true })).toBeDisabled();
  await expect.poll(() => attempts).toBe(2);
  release();
  await expect(page.getByRole("dialog", { name: "Submit Planting Report", exact: true })).toBeVisible();
  await expect(page.locator("#planting-submittedByName")).toHaveValue("");
  await expect(page.getByRole("status").filter({ hasText: "Planting Report Submitted Successfully" })).toContainText("Status: Pending Review.");
  await expect(page.getByRole("button", { name: "Submitting...", exact: true })).toHaveCount(0);
  expect(attempts).toBe(2);
  fixture.check();
});

test("Participant preserves the backend's existing generic HTTP 500 message and releases Submit", async ({ page }) => {
  // This is the unexpected-error message returned by plantingReport.controller.
  const message = "Failed to submit planting report. Please try again.";
  const fixture = await participantEvidenceForm(page, { "POST /api/planting-reports": route => route.fulfill({ status: 500,
    json: { success: false, message } }) });
  await reportIdentity(page); await takeFixturePhoto(page);
  await page.getByRole("button", { name: "Submit Report", exact: true }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Report", exact: true })).toBeEnabled();
  await expect(page.getByRole("dialog", { name: "Submit Planting Report", exact: true })).toBeVisible();
  await expect(page.getByText(/Planting Report Submitted Successfully/)).toHaveCount(0);
  expect(fixture.calls.filter(call => call.key === "POST /api/planting-reports")).toHaveLength(1);
  fixture.check();
});

// Mobile participant submission: the user always knows whether the report is saved, unconfirmed, not saved or rejected.
const savedRow = { id: "event_event-1", reportType: "parent", eventId: "event-1", submissions: [{ id: "submission-new", contributorId: "test-participant", staffReviewStatus: "Pending Review" }] };
async function mobileReport(page, overrides) {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await participantEvidenceForm(page, overrides);
  await reportIdentity(page); await takeFixturePhoto(page);
  return { fixture, submit: page.locator('form button[type="submit"]'), posts: () => fixture.calls.filter(call => call.key === "POST /api/planting-reports").length };
}
async function expectKept(page) {
  await expect(page.locator("#planting-submittedByName")).toHaveValue("Fixture requester");
  await expect(page.locator("#planting-submittedByContactNumber")).toHaveValue("09123456789");
  await expect(cameraEvidence(page)).toHaveCount(1);
}

test("mobile participant: an upload cut off partway is Not saved, keeps everything, and the retry succeeds", async ({ page }) => {
  // The first submission uploads 40% and then loses its connection; later ones are real.
  await page.addInitScript(() => {
    const Native = window.XMLHttpRequest; let cut = false;
    window.XMLHttpRequest = class extends Native {
      open(method, url, ...rest) { this.__cut = method === "POST" && /\/planting-reports$/.test(url) && !cut; return super.open(method, url, ...rest); }
      send(body) {
        if (!this.__cut) return super.send(body);
        cut = true; window.__photosInFirstAttempt = body.getAll("photos").length;
        setTimeout(() => { this.upload.onprogress({ lengthComputable: true, loaded: 40, total: 100 }); setTimeout(() => this.onerror(), 600); }, 20);
      }
    };
  });
  const { fixture, submit, posts } = await mobileReport(page, { "POST /api/planting-reports": route => route.fulfill({ status: 201, json: { success: true, message: "Awaiting MENRO Staff verification.", data: { id: "saved" } } }) });
  await submit.click();
  await expect(page.getByRole("status").filter({ hasText: "Uploading photos… 40%. Keep this page open." })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Not saved. Your entries and photos are kept" })).toBeInViewport();
  await expect(page.locator(".pr-submit-alert")).toContainText("your report was not saved");
  await expect(submit).toHaveText(/Submit Report/); await expect(submit).toBeEnabled();
  await expect(page.getByText(/may already be saved|Check Submission/)).toHaveCount(0);
  await expectKept(page); expect(await page.evaluate(() => window.__photosInFirstAttempt)).toBe(1); expect(posts()).toBe(0);
  await submit.click();
  await expect(page.getByRole("status").filter({ hasText: "Planting Report Submitted Successfully" })).toContainText("Status: Pending Review.");
  expect(posts()).toBe(1);
  fixture.check();
});

test("mobile participant: still processing is Not yet confirmed, never replaced, and Check Submission finds the saved report", async ({ page }) => {
  let saved = false;
  const { fixture, submit, posts } = await mobileReport(page, {
    "POST /api/planting-reports": route => route.fulfill({ status: 202, json: { success: false, code: "EVIDENCE_IN_PROGRESS", message: "Evidence processing is still in progress." } }),
    "GET /api/planting-reports/my-reports": route => route.fulfill({ json: { success: true, data: saved ? [savedRow] : [] } }) });
  await submit.click();
  await expect(page.locator(".pr-submit-alert")).toContainText("still processing the photos");
  await expect(page.getByRole("status").filter({ hasText: "Not yet confirmed by MENRO." })).toBeVisible();
  await expect(submit).toHaveText(/Check Submission/); await expect(page.locator("#planting-submittedByName")).toBeDisabled(); await expectKept(page);
  // Checked too early: the same submission is sent again under the same key and is still processing.
  await submit.click();
  await expect.poll(posts).toBe(2); await expect(submit).toHaveText(/Check Submission/); await expectKept(page);
  saved = true; await submit.click();
  await expect(page.getByText(/Your planting report was saved and is awaiting MENRO Staff verification/).first()).toBeVisible();
  expect(posts()).toBe(2);
  fixture.check();
});

test("mobile participant: a refusal is shown as Not accepted with MENRO's reason and an editable form", async ({ page }) => {
  const { fixture, submit, posts } = await mobileReport(page, { "POST /api/planting-reports": route => route.fulfill({ status: 400, json: { success: false, message: "Duplicate planting image detected." } }) });
  await submit.click();
  await expect(page.locator(".pr-submit-alert")).toContainText("Duplicate planting image detected.");
  await expect(page.getByRole("status").filter({ hasText: "Not accepted by MENRO." })).toBeVisible();
  await expect(submit).toHaveText(/Submit Report/); await expect(page.locator("#planting-submittedByName")).toBeEnabled(); await expectKept(page);
  expect(posts()).toBe(1);
  fixture.check();
});

test("Staff saved report retries evidence after a lost upload response without checking or reposting quantities", async ({ page }) => {
  let attempts = 0; const keys = [];
  const fixture = await staffForm(page, { "PUT /api/planting-reports/official/submission-fixture/photos": (route, request) => {
    keys.push(request.headers()["idempotency-key"]);
    return ++attempts === 1 ? route.abort("connectionfailed") : route.fulfill({ json: { success: true, data: { evidenceVerified: true } } });
  } });
  await takeFixturePhoto(page);
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /^Report saved — retry evidence\./ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check Submission", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Take Photo", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Upload Evidence for Saved Report", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Submit Official Planting Report", exact: true })).toHaveCount(0);
  expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]);
  expect(fixture.calls.filter(call => call.key === "POST /api/planting-reports/official")).toHaveLength(1);
  fixture.check();
});

test("Participant upload without EXIF is rejected without touching a verified camera photo", async ({ page }) => {
  const fixture = await participantEvidenceForm(page);
  await takeFixturePhoto(page); await expect(cameraEvidence(page)).toHaveCount(1);
  await page.locator("#planting-photos").setInputFiles(noExifImage);
  await expect(uploadFailure(page)).toHaveCount(1); await expect(cameraEvidence(page)).toHaveCount(1);
  const verifyAgain = page.locator(".pr-gps-top").getByRole("button", { name: "Verify Again", exact: true });
  await expect(verifyAgain).toBeVisible(); await verifyAgain.click();
  await expect(uploadFailure(page)).toHaveCount(1);
  await expect(verifyAgain).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).last().click();
  await expect(uploadFailure(page)).toHaveCount(0); await expect(cameraEvidence(page)).toHaveCount(1);
  await expect(verifyAgain).toBeVisible(); fixture.check();
});

test("Participant camera photo supplies the location after an earlier upload failed", async ({ page }) => {
  const fixture = await participantEvidenceForm(page);
  await page.locator("#planting-photos").setInputFiles(noExifImage);
  await expect(uploadFailure(page)).toHaveCount(1);
  await takeFixturePhoto(page); await expect(cameraEvidence(page)).toHaveCount(1);
  await expect(page.locator(".pr-gps-top").getByRole("button", { name: "Verify Again", exact: true })).toBeVisible();
  await expect(uploadFailure(page)).toHaveCount(1); fixture.check();
});

test("Staff upload without EXIF is rejected and a camera photo keeps its capture descriptor", async ({ page }) => {
  let manifest;
  const fixture = await staffForm(page, { "PUT /api/planting-reports/official/submission-fixture/photos": (route, request) => {
    manifest = JSON.parse(/name="evidenceManifest"\r\n\r\n(.*)\r\n/.exec(request.postDataBuffer().toString())[1]);
    return route.fulfill({ json: { success: true, data: { hasEvidence: true, evidenceVerified: true, evidenceSubmissionId: "submission-fixture" } } });
  } });
  await takeFixturePhoto(page);
  await expect(page.getByText("Backend-verified camera capture", { exact: true })).toBeVisible();
  await page.locator(".pr-official-dialog input[type=file].pr-file-input").setInputFiles(noExifImage);
  await page.getByRole("button", { name: "Verify Photo Location", exact: true }).click();
  await expect(page.getByRole("group", { name: "Location Verification", exact: true }).getByRole("alert")).toContainText("no-exif.png has no GPS metadata");
  await expect(page.getByText("Backend-verified camera capture", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  const location = page.getByRole("group", { name: "Location Verification", exact: true });
  await expect(location.getByRole("alert")).toContainText("no-exif.png has no GPS metadata");
  await expect(location).toHaveAttribute("aria-invalid", "true");
  await expect(location).toHaveAttribute("aria-describedby", "official-location-error");
  await expect(location).toBeFocused();
  expect(fixture.calls.filter(call => call.key === "POST /api/planting-reports/official")).toHaveLength(0);
  await page.getByRole("button", { name: "Remove planting photo no-exif.png", exact: true }).click();
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("dialog", { name: "Submit Official Planting Report" })).toHaveCount(0);
  expect(manifest).toHaveLength(1); expect(manifest[0].source).toBe("browser-camera"); expect(manifest[0].captureSessionId).toBe("mock-session"); fixture.check();
});

// ---------------------------------------------------------------------------
// Planting report review workflow (Participant -> Staff -> Admin; Staff -> Admin)
// ---------------------------------------------------------------------------
const reviewPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQkAAAAASUVORK5CYII=", "base64");
const reviewPhoto = { latitude: 12.6598, longitude: 123.918, locationAccuracyMeters: 6, photoCapturedAt: "2026-11-05T01:00:00.000Z",
  locationCapturedAt: "2026-11-05T01:00:05.000Z", gpsValid: true, siteGpsValid: true, timestampValid: true,
  siteLocationStatus: "Within Assigned Site", locationSource: "Secure Camera" };
const reviewSubmission = (overrides = {}) => ({ id: "sub-participant", reportId: "report-review", eventId: "event-1", contributorId: "test-participant",
  participantId: "test-participant", authenticatedSubmitterUid: "test-participant", submittedByName: "Field Volunteer", species: "Narra", inventoryId: "narra",
  quantity: 10, verificationStatus: "Verified", staffReviewStatus: "Pending Review", workflowStatus: "Pending Review", staffApprovalRequired: true,
  latitude: 12.6598, longitude: 123.918, gpsAccuracyMeters: 6, photos: [reviewPhoto], ...overrides });
const reviewReport = (submissions) => ({ id: "report-review", reportType: "parent", reportNumber: "RPT-2026-0101", siteId: "site-1", siteName: "Fixture site",
  barangay: "Bical", eventName: "Approved planting", eventId: "event-1", reportingProgress: "Fully Reported — Awaiting Review",
  verificationStatus: "Fully Reported — Awaiting Review", quantityReleased: 10, quantityPlanted: 10, acceptedQuantity: 0, pendingReviewQuantity: 10,
  rejectedQuantity: 0, remainingAvailableQuantity: 0, createdAt: "2026-11-05T02:00:00.000Z",
  photos: submissions.flatMap((submission) => submission.photos || []), submissions });
// Review / Verify / Return / Reject live only in the View Planting Report footer, grouped per submission.
const decisionFooter = page => page.locator(".pr-report-drawer > footer.pr-drawer-footer");
const decisionsFor = (page, id) => decisionFooter(page).getByRole("group", { name: `Decision for submission ${id}` });
async function reviewFixture(page, current, overrides = {}) {
  const list = route => route.fulfill({ json: { success: true, data: [current()] } });
  const photos = {};
  for (let index = 0; index < 4; index += 1) photos[`GET /api/evidence/planting-reports/report-review/photos/${index}`] = route => route.fulfill({ status: 200, contentType: "image/png", body: reviewPng });
  return setup(page, { "GET /api/planting-reports": list, "GET /api/planting-reports/my-reports": list,
    "GET /api/planting-reports/report-review/verification-logs": route => route.fulfill({ json: { success: true, data: [] } }),
    // Verified reports load the read-only Monitoring Status (no cohort exists for this fixture).
    "GET /api/verified-planting-cohorts": route => route.fulfill({ json: { success: true, data: [] } }),
    "GET /api/verified-sample-monitoring/readiness": route => route.fulfill({ json: { success: true, data: { cohorts: [], truncated: false, visitCreationAvailable: false } } }),
    ...photos, ...overrides });
}

test("Staff reviews a participant report: Return requires a reason, closes only after success and blocks repeats", async ({ page }) => {
  let report = reviewReport([reviewSubmission()]), release;
  const returnCalls = [];
  const fixture = await reviewFixture(page, () => report, {
    "PATCH /api/planting-reports/sub-participant/return": async (route, request) => {
      returnCalls.push(request.postDataJSON());
      await new Promise(resolve => { release = resolve; });
      report = reviewReport([reviewSubmission({ workflowStatus: "Returned for Correction", staffReviewStatus: "Rejected", returnReason: "Retake the photo inside the site", returnedByName: "Field Staff", correctionAllowed: true })]);
      return route.fulfill({ json: { success: true, message: "Planting report returned for correction.", data: report } });
    },
  });
  await page.goto("/staff/planting-reports?role=staff&report=report-review");
  const card = page.getByRole("article", { name: "Submission sub-participant" });
  await expect(card.locator('[data-workflow-status="Pending Review"]')).toBeVisible();
  await expect(card.locator('[data-workflow-status="Pending Review"]')).toHaveClass(/pr-status-pending/);
  await expect(decisionsFor(page, "sub-participant").getByRole("button", { name: "Verify", exact: true })).toHaveCount(0);
  await expect(decisionsFor(page, "sub-participant").getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
  await expect(decisionsFor(page, "sub-participant").getByRole("button", { name: "Review", exact: true })).toBeVisible();
  await decisionsFor(page, "sub-participant").getByRole("button", { name: "Return for Correction", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Return for Correction", exact: true });
  const reason = dialog.getByLabel(/Reason for Return/);
  await expect(reason).toBeFocused();
  await dialog.getByRole("button", { name: "Return for Correction", exact: true }).click();
  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByRole("alert")).toContainText("Enter the reason for returning this planting report.");
  expect(returnCalls).toHaveLength(0);
  await reason.fill("Retake the photo inside the site");
  await expect(reason).not.toHaveAttribute("aria-invalid", "true");
  await dialog.getByRole("button", { name: "Return for Correction", exact: true }).click();
  const busy = dialog.getByRole("button", { name: "Returning...", exact: true });
  await expect(busy).toBeDisabled();
  await dialog.locator("form").evaluate(form => form.requestSubmit());
  await expect(dialog).toBeVisible();
  expect(returnCalls).toEqual([{ remarks: "Retake the photo inside the site" }]);
  release();
  await expect(dialog).toHaveCount(0);
  await expect(card.locator('[data-workflow-status="Returned for Correction"]')).toBeVisible();
  await expect(card.getByText("Retake the photo inside the site", { exact: true })).toBeVisible();
  await expect(decisionsFor(page, "sub-participant").getByRole("button", { name: "Review", exact: true })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Planting report returned for correction." })).toBeVisible();
  expect(returnCalls).toHaveLength(1); fixture.check();
});

test("Staff forwards a participant report to Admin with optional comments", async ({ page }) => {
  let report = reviewReport([reviewSubmission()]);
  const fixture = await reviewFixture(page, () => report, {
    "PATCH /api/planting-reports/sub-participant/forward": (route, request) => {
      expect(request.postDataJSON()).toEqual({ remarks: "" });
      report = reviewReport([reviewSubmission({ workflowStatus: "Reviewed", staffReviewedBy: "test-staff", staffReviewedByName: "Field Staff", staffReviewedAt: "2026-11-06T01:00:00.000Z" })]);
      return route.fulfill({ json: { success: true, message: "Planting report reviewed and forwarded to the MENRO Admin for approval.", data: report } });
    },
  });
  await page.goto("/staff/planting-reports?role=staff&report=report-review");
  const card = page.getByRole("article", { name: "Submission sub-participant" });
  await decisionsFor(page, "sub-participant").getByRole("button", { name: "Review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review Planting Report?", exact: true });
  await expect(dialog.getByText("(optional)")).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm Review", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const badge = card.locator('[data-workflow-status="Reviewed"]');
  await expect(badge).toBeVisible(); await expect(badge).toHaveClass(/pr-status-reviewed/);
  await expect(card.getByText("Awaiting MENRO Admin verification.", { exact: true })).toBeVisible();
  fixture.check();
});

test("Admin decides only Staff-reviewed participant reports and keeps the modal open when a decision fails", async ({ page }) => {
  let attempts = 0;
  const pending = reviewSubmission({ id: "sub-waiting" });
  const reviewed = reviewSubmission({ id: "sub-reviewed", workflowStatus: "Reviewed", staffReviewedBy: "staff-1", staffReviewedByName: "Field Staff",
    staffReviewedAt: "2026-11-06T01:00:00.000Z", staffReviewRemarks: "Photos match the site", photos: [] });
  let report = reviewReport([pending, reviewed]);
  const fixture = await reviewFixture(page, () => report, {
    "GET /api/planting-reports/report-review/verification-logs": route => route.fulfill({ json: { success: true, data: [{ id: "log-1", action: "Staff Review — Forwarded to Admin",
      previousStatus: "Pending Review", newStatus: "Reviewed", performedByName: "Field Staff", performedByRole: "staff", submissionId: "sub-reviewed",
      remarks: "Photos match the site", createdAt: "2026-11-06T01:00:00.000Z" }] } }),
    "PATCH /api/planting-reports/sub-reviewed/reject": (route, request) => {
      attempts += 1;
      if (attempts === 1) return route.fulfill({ status: 409, json: { success: false, message: "This planting report changed. Refresh before deciding." } });
      report = reviewReport([pending, { ...reviewed, workflowStatus: "Rejected", staffReviewStatus: "Rejected", rejectionReason: request.postDataJSON().remarks, adminDecisionBy: "test-admin", adminDecisionByName: "MENRO Admin", adminDecisionAt: "2026-11-07T01:00:00.000Z" }]);
      return route.fulfill({ json: { success: true, message: "Planting report rejected.", data: report } });
    },
  });
  await page.goto("/admin/planting-reports?role=admin&report=report-review");
  const waiting = page.getByRole("article", { name: "Submission sub-waiting" });
  await expect(waiting.getByText("Awaiting MENRO Staff review before Admin verification.", { exact: true })).toBeVisible();
  for (const action of ["Verify", "Reject", "Review", "Return for Correction"]) await expect(decisionsFor(page, "sub-waiting").getByRole("button", { name: action, exact: true })).toHaveCount(0);
  const card = page.getByRole("article", { name: "Submission sub-reviewed" });
  await expect(decisionsFor(page, "sub-reviewed").getByRole("button", { name: "Return for Correction", exact: true })).toHaveCount(0);
  await expect(card.getByText("Photos match the site", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Submission and decision history" }).getByText("Staff Review — Forwarded to Admin")).toBeVisible();
  await decisionsFor(page, "sub-reviewed").getByRole("button", { name: "Reject", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Reject Planting Report", exact: true });
  await expect(dialog.getByText("Rejection is final.", { exact: false })).toBeVisible();
  await dialog.getByLabel(/Reason for Rejection/).fill("Seedlings were planted outside the approved site");
  await dialog.getByRole("button", { name: "Reject Report", exact: true }).click();
  await expect(dialog.locator(".pr-decision-alert")).toHaveText("This planting report changed. Refresh before deciding.");
  await expect(dialog.getByLabel(/Reason for Rejection/)).toHaveValue("Seedlings were planted outside the approved site");
  await dialog.getByRole("button", { name: "Reject Report", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const rejected = card.locator('[data-workflow-status="Rejected"]');
  await expect(rejected).toBeVisible(); await expect(rejected).toHaveClass(/pr-status-rejected/);
  await expect(card.getByText("Seedlings were planted outside the approved site", { exact: true })).toBeVisible();
  await expect(decisionsFor(page, "sub-reviewed").getByRole("button", { name: "Verify", exact: true })).toHaveCount(0);
  expect(attempts).toBe(2); fixture.check();
});

test("Staff-submitted reports go directly to Admin with approve, reject and return", async ({ page }) => {
  const report = reviewReport([reviewSubmission({ id: "sub-official", officialStaffReport: true, adminApprovalRequired: true, workflowStatus: "Pending Admin Approval",
    contributorId: "test-staff", authenticatedSubmitterUid: "test-staff", submittedByName: "Field Staff", confirmationBasis: "release-based", photos: [] })]);
  const fixture = await reviewFixture(page, () => report);
  await page.goto("/admin/planting-reports?role=admin&report=report-review");
  const card = page.getByRole("article", { name: "Submission sub-official" });
  const badge = card.locator('[data-workflow-status="Pending Admin Approval"]');
  await expect(badge).toBeVisible(); await expect(badge).toHaveClass(/pr-status-reviewed/);
  for (const action of ["Verify", "Reject", "Return for Correction"]) await expect(decisionsFor(page, "sub-official").getByRole("button", { name: action, exact: true })).toBeVisible();
  await expect(decisionsFor(page, "sub-official").getByRole("button", { name: "Review", exact: true })).toHaveCount(0);
  await decisionsFor(page, "sub-official").getByRole("button", { name: "Verify", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Verify Planting Report?", exact: true });
  await expect(dialog.getByText("makes this report eligible for survival monitoring preparation", { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  fixture.check();
});

test("View Report shows saved evidence on a read-only Bulan map without the upload prompt", async ({ page }) => {
  const report = reviewReport([
    reviewSubmission({ id: "sub-verified" }),
    reviewSubmission({ id: "sub-returned", workflowStatus: "Returned for Correction", staffReviewStatus: "Rejected", returnReason: "Blurry photo",
      photos: [{ ...reviewPhoto, latitude: 12.661, longitude: 123.921, gpsValid: true, siteGpsValid: false, timestampValid: true }] }),
  ]);
  const fixture = await reviewFixture(page, () => report);
  await page.goto("/staff/planting-reports?role=staff&report=report-review");
  const drawer = page.locator(".pr-report-drawer");
  await expect(drawer.getByRole("heading", { name: "Bulan Evidence Map", exact: true })).toBeVisible();
  await expect(drawer.getByText("2 saved evidence locations", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Verified (1)", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Rejected / Returned (1)", { exact: true })).toBeVisible();
  await expect(drawer.locator(".pr-evidence-map")).toHaveAttribute("data-boundary-status", "ready");
  await expect(drawer.locator(".pr-evidence-map .leaflet-interactive").first()).toBeVisible();
  await expect(drawer.getByText("Upload or take a photo first", { exact: false })).toHaveCount(0);
  const firstPhoto = drawer.locator(".pr-photo-evidence-details").first();
  await expect(firstPhoto.getByText("Verified Evidence", { exact: true })).toBeVisible();
  await expect(firstPhoto.getByText("± 6 m", { exact: true })).toBeVisible();
  for (const check of ["GPS: Passed", "Site: Passed", "Timestamp: Passed"]) await expect(firstPhoto.getByText(check, { exact: true })).toBeVisible();
  await expect(drawer.locator(".pr-photo-evidence-details").nth(1).getByText("Rejected / Returned Evidence", { exact: true })).toBeVisible();
  await expect(drawer.locator(".pr-photo-evidence-details").nth(1).getByText("Site: Failed", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await drawer.evaluate(element => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  fixture.check();
});

test("participant corrects only their own returned submission; rejected reports cannot be corrected", async ({ page }) => {
  const report = reviewReport([
    reviewSubmission({ id: "sub-own-returned", workflowStatus: "Returned for Correction", staffReviewStatus: "Rejected", returnReason: "Retake the photo inside the site", correctionAllowed: true, photos: [] }),
    reviewSubmission({ id: "sub-own-rejected", workflowStatus: "Rejected", staffReviewStatus: "Rejected", rejectionReason: "Outside the site", correctionAllowed: false, photos: [] }),
    reviewSubmission({ id: "sub-other-returned", contributorId: "other-participant", participantId: "other-participant", authenticatedSubmitterUid: "other-participant", workflowStatus: "Returned for Correction", staffReviewStatus: "Rejected", correctionAllowed: true, photos: [] }),
  ]);
  const fixture = await reviewFixture(page, () => report);
  await page.goto("/participant/my-planting-reports?role=participant&report=report-review");
  await expect(page.getByRole("article", { name: "Submission sub-own-rejected" }).getByRole("button", { name: "Correct and Resubmit" })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Submission sub-other-returned" }).getByRole("button", { name: "Correct and Resubmit" })).toHaveCount(0);
  for (const action of ["Review", "Return for Correction", "Verify", "Reject"]) await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
  await page.getByRole("article", { name: "Submission sub-own-returned" }).getByRole("button", { name: "Correct and Resubmit", exact: true }).click();
  const banner = page.getByRole("note", { name: "Correction details" });
  await expect(banner).toContainText("Retake the photo inside the site");
  await expect(banner).toContainText("Narra");
  fixture.check();
});

const twoTypeOption = { ...releaseOption, items: [releaseOption.items[0], { inventoryId: "molave", species: "Molave", quantityReleased: 6, availableQuantity: 6 }] };
const twoTypeOptions = route => route.fulfill({ json: { success: true, data: { options: [twoTypeOption], nextCursor: null } } });

test("Staff report lists every released seedling type with per-type planted, leftover and totals", async ({ page }) => {
  const fixture = await staffForm(page, { "GET /api/planting-reports/official/options": twoTypeOptions,
    "POST /api/planting-reports/official": route => route.fulfill({ status: 201, json: { success: true, data: { id: "report-fixture", officialSubmissionIds: ["submission-fixture", "submission-two"] } } }) });
  await expect(page.getByRole("heading", { name: "Seedlings Planted (2 seedling types)", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Narra", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Molave", exact: true })).toBeVisible();
  const planted = page.getByLabel("Quantity Planted *", { exact: true }), leftover = page.getByLabel("Final Leftover Seedlings (Not Planted)", { exact: true });
  await expect(planted).toHaveCount(2); await expect(leftover).toHaveCount(2);
  await expect(page.getByLabel("Quantity Released", { exact: true }).nth(1)).toHaveValue("6");
  await expect(planted.nth(0)).toHaveValue("8"); await expect(planted.nth(1)).toHaveValue("6");
  for (const index of [0, 1]) await expect(planted.nth(index)).toHaveAttribute("readonly");
  const totals = page.getByLabel("Report totals");
  await expect(totals).toContainText("Seedling Types2"); await expect(totals).toContainText("Available for Reporting14"); await expect(totals).toContainText("Total Planted14");
  await leftover.nth(1).fill("7");
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByText("Leftover cannot exceed the 6 seedlings available.", { exact: true })).toBeVisible();
  await expect(leftover.nth(1)).toHaveAttribute("aria-invalid", "true"); await expect(leftover.nth(1)).toBeFocused();
  await expect(leftover.nth(0)).not.toHaveAttribute("aria-invalid", "true");
  await leftover.nth(0).fill("2"); await leftover.nth(1).fill("1");
  for (const reason of await page.getByLabel("Reason for Leftover Seedlings *", { exact: true }).all()) await reason.fill("Seedlings damaged during transport");
  await expect(planted.nth(0)).toHaveValue("6"); await expect(planted.nth(1)).toHaveValue("5");
  await expect(totals).toContainText("Total Planted11"); await expect(totals).toContainText("Total Leftover3");
  await page.getByRole("button", { name: "Take Photo", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
  await expect(page.getByText("Backend-verified camera capture", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByRole("dialog", { name: "Submit Official Planting Report" })).toHaveCount(0);
  const request = fixture.calls.find(call => call.key === "POST /api/planting-reports/official");
  expect(request.body.items).toEqual([{ inventoryId: "narra", quantityPlanted: 6, leftoverQuantity: 2, leftoverReason: "Seedlings damaged during transport" }, { inventoryId: "molave", quantityPlanted: 5, leftoverQuantity: 1, leftoverReason: "Seedlings damaged during transport" }]);
  expect(fixture.calls.filter(call => call.key === "PUT /api/planting-reports/official/submission-fixture/photos")).toHaveLength(1);
  fixture.check();
});

test("partially reported multi-type release keeps fully reported types read-only and shows a combined server error once", async ({ page }) => {
  const partial = { ...twoTypeOption, items: [{ ...twoTypeOption.items[0], availableQuantity: 0 }, twoTypeOption.items[1]] };
  const fixture = await staffForm(page, { "GET /api/planting-reports/official/options": route => route.fulfill({ json: { success: true, data: { options: [partial], nextCursor: null } } }),
    "POST /api/planting-reports/official": route => route.fulfill({ status: 409, json: { success: false, message: "Planted and leftover quantities exceed the available reportable balance.", fieldErrors: { items: "Refresh the release and enter quantities within its available balance." } } }) });
  await page.getByLabel("Confirmation Basis").selectOption("release-based");
  await expect(page.getByRole("status").filter({ hasText: "All released Narra are already reported." })).toBeVisible();
  const leftover = page.getByLabel("Final Leftover Seedlings (Not Planted)", { exact: true });
  await expect(leftover.nth(0)).toHaveAttribute("readonly"); await expect(leftover.nth(1)).not.toHaveAttribute("readonly");
  await expect(page.getByLabel("Quantity Planted *", { exact: true }).nth(0)).toHaveValue("0");
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByText("Refresh the release and enter quantities within its available balance.", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "Submit Official Planting Report" })).toBeVisible();
  const request = fixture.calls.find(call => call.key === "POST /api/planting-reports/official");
  expect(request.body.items).toEqual([{ inventoryId: "narra", quantityPlanted: 0, leftoverQuantity: 0 }, { inventoryId: "molave", quantityPlanted: 6, leftoverQuantity: 0 }]);
  fixture.check();
});

test("Staff form explains planted quantity and confirmation basis in plain language", async ({ page }) => {
  const fixture = await staffForm(page);
  await expect(page.getByText(/derived by the backend/)).toHaveCount(0);
  await expect(page.getByText("Enter any leftover seedlings for each type. Quantity Planted is calculated automatically: released seedlings minus leftovers.", { exact: true })).toBeVisible();
  const basis = page.getByLabel("Confirmation Basis");
  await expect(basis.locator("option")).toHaveText(["MENRO Field Report", "Individual Release-Based Confirmation"]);
  await expect(page.locator("#official-basis-help")).toHaveText(/Original planting photos taken at the site are required/);
  await basis.selectOption("release-based");
  await expect(page.getByText(/derived by the backend/)).toHaveCount(0);
  await expect(page.locator("#official-basis-help")).toHaveText("Confirms planting from the release record of an individual requester. Site photos are not required.");
  await expect(basis).toHaveAttribute("aria-describedby", "official-basis-help");
  await expect(page.getByRole("button", { name: "Take Photo", exact: true })).toHaveCount(0);
  fixture.check();
});

test("cancelling the attendance or photo file picker keeps the Staff form open with its data", async ({ page }) => {
  const fixture = await staffForm(page, { "GET /api/planting-reports/official/options": twoTypeOptions });
  const dialog = page.getByRole("dialog", { name: "Submit Official Planting Report", exact: true });
  const leftover = page.getByLabel("Final Leftover Seedlings (Not Planted)", { exact: true });
  await leftover.nth(1).fill("2"); await page.getByLabel("Remarks").fill("Kept remarks");
  const attendance = page.getByLabel("Attendance Photo/File (Optional)");
  // Chrome dispatches a bubbling "cancel" on the file input when its picker is closed with X or Cancel.
  const dismissPicker = input => input.evaluate(node => node.dispatchEvent(new Event("cancel", { bubbles: true })));
  for (let attempt = 0; attempt < 2; attempt++) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Choose Attendance File" }).click();
    await chooser; await dismissPicker(attendance);
    await expect(dialog).toBeVisible();
  }
  await dismissPicker(page.locator(".pr-official-dialog input[type=file]").first());
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Seedling Release Record *" })).toHaveValue("released-request");
  await expect(leftover.nth(1)).toHaveValue("2"); await expect(page.getByLabel("Quantity Planted *", { exact: true }).nth(1)).toHaveValue("4");
  await expect(page.getByLabel("Remarks")).toHaveValue("Kept remarks");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose Attendance File" }).click();
  await (await chooser).setFiles({ name: "attendance.pdf", mimeType: "application/pdf", buffer: Buffer.from("fixture attendance") });
  await expect(page.getByText("attendance.pdf", { exact: true })).toBeVisible();
  const reopened = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose Attendance File" }).click();
  await reopened; await dismissPicker(attendance);
  await expect(dialog).toBeVisible(); await expect(page.getByText("attendance.pdf", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  fixture.check();
});

test("View Report shows every seedling type of a multi-type report and resuming evidence lists all saved types", async ({ page }) => {
  const row = (id, inventoryId, species, quantity, leftoverQuantity) => ({ id, requestId: "released-request", inventoryId, species, quantity, leftoverQuantity, revision: 0, officialOperationId: "operation-1",
    officialStaffReport: true, authenticatedSubmitterUid: "test-staff", confirmationBasis: "menro-field-report", staffReviewStatus: "Pending Review", adminApprovalRequired: true, photos: [] });
  const report = { id: "report-fixture", reportType: "parent", verificationStatus: "Fully Reported — Awaiting Review", species: "Narra, Molave", quantityReleased: 16, releasedItemQuantity: null, quantityPlanted: 14,
    allocationSummary: [{ inventoryId: "narra", species: "Narra", allocated: 10, recorded: 8, leftoverQuantity: 2, remaining: 0 }, { inventoryId: "molave", species: "Molave", allocated: 6, recorded: 6, leftoverQuantity: 0, remaining: 0 }],
    submissions: [row("submission-fixture", "narra", "Narra", 8, 2), row("submission-two", "molave", "Molave", 6, 0)], photos: [] };
  const fixture = await staffForm(page, { "GET /api/planting-reports/official/options": route => route.fulfill({ json: { success: true, data: { options: [{ ...twoTypeOption, items: twoTypeOption.items.map(item => ({ ...item, availableQuantity: 0 })) }], nextCursor: null } } }),
    "GET /api/planting-reports": route => route.fulfill({ json: { success: true, data: [report] } }),
    "GET /api/planting-reports/report-fixture": route => route.fulfill({ json: { success: true, data: report } }),
    "GET /api/planting-reports/report-fixture/verification-logs": route => route.fulfill({ json: { success: true, data: [] } }) });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("/staff/planting-reports?role=staff&report=report-fixture");
  await expect(page.locator(".pr-info-block").filter({ hasText: "Tree Species" }).first().locator(".pr-info-value")).toHaveText("Narra, Molave");
  await expect(page.locator(".pr-info-block").filter({ hasText: "Released Quantity" }).locator(".pr-info-value")).toHaveText("16");
  const breakdown = page.getByRole("table", { name: "Seedlings per Type" });
  await expect(breakdown.getByRole("row")).toHaveCount(3);
  await expect(breakdown.getByRole("row", { name: /Narra/ })).toHaveText(/Narra\s*10\s*8\s*2\s*0/);
  await expect(breakdown.getByRole("row", { name: /Molave/ })).toHaveText(/Molave\s*6\s*6\s*0\s*0/);
  await page.getByRole("button", { name: "Add Verified Planting Evidence", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Narra", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Molave", exact: true })).toBeVisible();
  await expect(page.getByLabel("Quantity Planted *", { exact: true }).nth(0)).toHaveValue("8");
  await expect(page.getByLabel("Quantity Planted *", { exact: true }).nth(1)).toHaveValue("6");
  fixture.check();
});
for (const [label, workflow, expected] of [
  ["registered site area", { siteMode: "existing", areaSource: "registered-site", areaHectares: 2.5, areaChoice: "" }, "2.5 ha (registered site area)"],
  ["missing registered area", { siteMode: "existing", areaSource: "registered-site", areaHectares: null, areaChoice: "" }, "Not recorded for the registered site"],
  ["proposed exact area", { siteMode: "proposed", areaChoice: "Other / Exact Area", exactArea: "0.75", areaHectares: 0.75 }, "0.75 ha"],
  ["proposed without area", { siteMode: "proposed", areaChoice: "", areaHectares: null }, "Not provided"],
  ["legacy existing-site choice", { siteMode: "existing", areaChoice: "1 hectare" }, "1 hectare"],
]) {
  test(`request details show the planting area for ${label}`, async ({ page }) => {
    const base = ownRequest("Pending", "other-requester");
    const request = { ...base, workflow: { ...base.workflow, areaChoice: undefined, areaHectares: undefined, ...workflow } };
    const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }) });
    await page.goto("/staff/requests?role=staff"); await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click();
    await expect(page.locator(".sr-detail-tree-row").filter({ hasText: "Planting Area" }).locator("strong")).toHaveText(expected);
    fixture.check();
  });
}

// Stored stages stay truthful (data-workflow-status / data-review-status); only the visible label is role-specific.
const roleLabelCases = [
  ["Pending Review", {}, { participant: "Submitted", staff: "Awaiting Review", admin: "Submitted" }],
  ["Reviewed", { staffReviewedBy: "test-staff", staffReviewedByName: "Field Staff", staffReviewedAt: "2026-11-06T01:00:00.000Z" }, { participant: "Submitted", staff: "Reviewed", admin: "Reviewed" }],
  ["Pending Admin Approval", { officialStaffReport: true, adminApprovalRequired: true, contributorId: "test-staff", authenticatedSubmitterUid: "test-staff" }, { staff: "Submitted", admin: "Staff Submitted" }],
  ["Completed", { staffReviewStatus: "Accepted", adminDecisionBy: "test-admin", adminDecisionByName: "MENRO Admin", adminDecisionAt: "2026-11-07T01:00:00.000Z" }, { participant: "Submitted", staff: "Verified", admin: "Verified" }],
];
for (const [stage, extra, labels] of roleLabelCases) for (const [role, label] of Object.entries(labels))
test(`${role} sees "${label}" for a stored ${stage} planting report`, async ({ page }) => {
  const report = { ...reviewReport([reviewSubmission({ workflowStatus: stage, ...extra })]), ...(stage === "Completed" ? { reportingProgress: "Completed" } : {}) };
  const fixture = await reviewFixture(page, () => report);
  const base = role === "participant" ? "/participant/my-planting-reports" : `/${role}/planting-reports`;
  await page.goto(`${base}?role=${role}`);
  const line = page.locator(".pr-review-line").first();
  await expect(line).toHaveAttribute("data-review-status", stage);
  await expect(line).toHaveText(`Status: ${label}`);
  await page.goto(`${base}?role=${role}&report=report-review`);
  const badge = page.locator(`.pr-submission-item [data-workflow-status="${stage}"]`).first();
  await expect(badge).toHaveText(label);
  if (role === "participant") {
    await expect(page.getByText(/Awaiting MENRO (Staff review|Admin verification)/)).toHaveCount(0);
    await expect(page.getByText("Verified By / At")).toHaveCount(0);
    await expect(page.getByText("Staff Review", { exact: true })).toHaveCount(0);
    for (const title of ["Pending Review", "Pending Verification", "Verified"]) await expect(page.locator(".kpi-card-title").filter({ hasText: new RegExp(`^${title}$`) })).toHaveCount(0);
    await expect(page.locator(".kpi-card-title").filter({ hasText: /^Submitted$/ })).toHaveCount(1);
  }
  fixture.check();
});

test("Staff cannot verify, and Admin cannot verify a participant report before Staff review", async ({ page }) => {
  const report = reviewReport([reviewSubmission({ workflowStatus: "Pending Review" })]);
  const fixture = await reviewFixture(page, () => report);
  await page.goto("/admin/planting-reports?role=admin&report=report-review");
  const card = page.getByRole("article", { name: "Submission sub-participant" });
  await expect(card.locator('[data-workflow-status="Pending Review"]')).toHaveText("Submitted");
  for (const action of ["Verify", "Reject", "Review", "Return for Correction"]) await expect(page.locator(".pr-report-drawer").getByRole("button", { name: action, exact: true })).toHaveCount(0);
  await expect(decisionFooter(page)).toHaveCount(0);
  fixture.check();
  const own = reviewReport([reviewSubmission({ id: "sub-official", workflowStatus: "Pending Admin Approval", officialStaffReport: true, adminApprovalRequired: true, contributorId: "test-staff", authenticatedSubmitterUid: "test-staff" })]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const ownFixture = await reviewFixture(page, () => own);
  await page.goto("/staff/planting-reports?role=staff&report=report-review");
  const ownCard = page.getByRole("article", { name: "Submission sub-official" });
  await expect(ownCard.locator('[data-workflow-status="Pending Admin Approval"]')).toHaveText("Submitted");
  for (const action of ["Verify", "Review", "Reject", "Return for Correction"]) await expect(page.locator(".pr-report-drawer").getByRole("button", { name: action, exact: true })).toHaveCount(0);
  await expect(decisionFooter(page)).toHaveCount(0);
  ownFixture.check();
});

// ---------------------------------------------------------------------------
// Review / Verify live only in the View Planting Report footer, and "Verified"
// appears only after a successful Admin verification.
// ---------------------------------------------------------------------------
const decisionNames = /^(Review|Verify|Return for Correction|Reject)$/;
async function expectFooterAtBottom(page) {
  const drawer = page.locator(".pr-report-drawer");
  await expect(drawer.locator(".pr-submission-item").getByRole("button", { name: decisionNames })).toHaveCount(0);
  await expect(drawer.locator(".pr-standalone-review").getByRole("button", { name: decisionNames })).toHaveCount(0);
  const placement = await drawer.evaluate(node => {
    const footer = node.querySelector(":scope > footer.pr-drawer-footer");
    const box = footer.getBoundingClientRect(), outer = node.getBoundingClientRect();
    return { last: node.lastElementChild === footer, bottomGap: Math.abs(outer.bottom - box.bottom) };
  });
  expect(placement.last).toBe(true);
  expect(placement.bottomGap).toBeLessThanOrEqual(2);
}

test("Participant report: Awaiting Review -> Staff Review -> Reviewed -> Admin Verify -> Verified, actions only at the bottom", async ({ page }) => {
  let report = reviewReport([reviewSubmission()]);
  const calls = [];
  const fixture = await reviewFixture(page, () => report, {
    "PATCH /api/planting-reports/sub-participant/forward": route => {
      calls.push("forward");
      report = reviewReport([reviewSubmission({ workflowStatus: "Reviewed", staffReviewedBy: "test-staff", staffReviewedByName: "Field Staff", staffReviewedAt: "2026-11-06T01:00:00.000Z" })]);
      return route.fulfill({ json: { success: true, message: "Planting report reviewed.", data: report } });
    },
    "PATCH /api/planting-reports/sub-participant/approve": route => {
      calls.push("approve");
      report = { ...reviewReport([reviewSubmission({ workflowStatus: "Completed", staffReviewStatus: "Accepted", staffReviewedBy: "test-staff", staffReviewedByName: "Field Staff",
        adminDecisionBy: "test-admin", adminDecisionByName: "MENRO Admin", adminDecisionAt: "2026-11-07T01:00:00.000Z" })]), reportingProgress: "Completed" };
      return route.fulfill({ json: { success: true, message: "Planting report approved.", data: report } });
    },
  });
  const drawer = page.locator(".pr-report-drawer");
  const card = page.getByRole("article", { name: "Submission sub-participant" });
  const tableStatus = page.locator(".pr-review-line").first();

  // Staff: Awaiting Review. The automated GPS check (stored "Verified") is not shown as Verified.
  await page.goto("/staff/planting-reports?role=staff&report=report-review");
  await expect(tableStatus).toHaveText("Status: Awaiting Review");
  await expect(card.locator('[data-workflow-status="Pending Review"]')).toHaveText("Awaiting Review");
  await expect(card.getByText("GPS Check Passed", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Verified", { exact: true })).toHaveCount(0);
  await expectFooterAtBottom(page);
  await expect(decisionsFor(page, "sub-participant").getByRole("button", { name: "Review", exact: true })).toBeEnabled();
  await expect(drawer.getByRole("button", { name: "Verify", exact: true })).toHaveCount(0);
  await decisionsFor(page, "sub-participant").getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("dialog", { name: "Review Planting Report?", exact: true }).getByRole("button", { name: "Confirm Review", exact: true }).click();
  await expect(card.locator('[data-workflow-status="Reviewed"]')).toHaveText("Reviewed");
  await expect(tableStatus).toHaveText("Status: Reviewed");
  // Staff review never marks the report Verified, and Staff get no further actions.
  await expect(drawer.getByText("Verified", { exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: decisionNames })).toHaveCount(0);
  await expect(decisionFooter(page)).toHaveCount(0);

  // Admin: Verify is enabled only now, at the bottom; afterwards the report reads Verified and actions are gone.
  await page.goto("/admin/planting-reports?role=admin&report=report-review");
  await expect(card.locator('[data-workflow-status="Reviewed"]')).toHaveText("Reviewed");
  await expectFooterAtBottom(page);
  await expect(decisionsFor(page, "sub-participant").getByRole("button", { name: "Verify", exact: true })).toBeEnabled();
  await expect(drawer.getByRole("button", { name: "Review", exact: true })).toHaveCount(0);
  await decisionsFor(page, "sub-participant").getByRole("button", { name: "Verify", exact: true }).click();
  await page.getByRole("dialog", { name: "Verify Planting Report?", exact: true }).getByRole("button", { name: "Verify Report", exact: true }).click();
  await expect(card.locator('[data-workflow-status="Completed"]')).toHaveText("Verified");
  await expect(tableStatus).toHaveText("Status: Verified");
  await expect(drawer.getByRole("button", { name: decisionNames })).toHaveCount(0);
  await expect(decisionFooter(page)).toHaveCount(0);
  expect(calls).toEqual(["forward", "approve"]);
  fixture.check();
});

test("Staff-submitted report: Staff never see Review; Admin sees Staff Submitted and verifies directly from the bottom", async ({ page }) => {
  const official = overrides => reviewSubmission({ id: "sub-official", officialStaffReport: true, adminApprovalRequired: true, workflowStatus: "Pending Admin Approval",
    contributorId: "test-staff", authenticatedSubmitterUid: "test-staff", submittedByName: "Field Staff", confirmationBasis: "release-based", photos: [], ...overrides });
  let report = reviewReport([official()]);
  const fixture = await reviewFixture(page, () => report, {
    "PATCH /api/planting-reports/sub-official/approve": route => {
      report = { ...reviewReport([official({ workflowStatus: "Completed", staffReviewStatus: "Accepted", adminDecisionBy: "test-admin", adminDecisionByName: "MENRO Admin", adminDecisionAt: "2026-11-07T01:00:00.000Z" })]), reportingProgress: "Completed" };
      return route.fulfill({ json: { success: true, message: "Planting report approved.", data: report } });
    },
  });
  const drawer = page.locator(".pr-report-drawer");
  const card = page.getByRole("article", { name: "Submission sub-official" });
  const tableStatus = page.locator(".pr-review-line").first();
  await page.goto("/staff/planting-reports?role=staff&report=report-review");
  await expect(tableStatus).toHaveText("Status: Submitted");
  await expect(card.locator('[data-workflow-status="Pending Admin Approval"]')).toHaveText("Submitted");
  await expect(drawer.getByRole("button", { name: decisionNames })).toHaveCount(0);

  await page.goto("/admin/planting-reports?role=admin&report=report-review");
  await expect(tableStatus).toHaveText("Status: Staff Submitted");
  await expect(card.locator('[data-workflow-status="Pending Admin Approval"]')).toHaveText("Staff Submitted");
  await expect(drawer.getByText("Verified", { exact: true })).toHaveCount(0);
  await expectFooterAtBottom(page);
  await expect(drawer.getByRole("button", { name: "Review", exact: true })).toHaveCount(0);
  await decisionsFor(page, "sub-official").getByRole("button", { name: "Verify", exact: true }).click();
  await page.getByRole("dialog", { name: "Verify Planting Report?", exact: true }).getByRole("button", { name: "Verify Report", exact: true }).click();
  await expect(card.locator('[data-workflow-status="Completed"]')).toHaveText("Verified");
  await expect(tableStatus).toHaveText("Status: Verified");
  await expect(decisionFooter(page)).toHaveCount(0);
  fixture.check();
});

// Staff-encoded walk-in: Admin approves, the Staff encoder releases, and reporting follows the stored policy.
const walkInApproved = (extra = {}) => ({ ...ownRequest("Approved", "walkin-citizen"), participantName: "Walk-in Citizen", requesterRole: "walk-in", createdByRole: "staff", submissionPath: "STAFF_DIRECT_TO_ADMIN",
  submittedByUid: "test-staff", submittedByName: "Encoding Staff", approvedBy: "test-admin", eventId: "event-1", walkIn: { encodedBy: "test-staff", encodedByName: "Encoding Staff", citizenHasAccount: false }, ...extra });
async function openWalkIn(page, initial, reporting, overrides = {}) {
  const state = { request: initial, bodies: [] };
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [state.request] } }),
    "GET /api/inventory": route => route.fulfill({ json: { success: true, data: [{ id: "tree-1", species: "Narra", availableQuantity: 10, reservedQuantity: 0 }] } }),
    "PATCH /api/seedling-requests/staff-own-request/release": (route, req) => { state.bodies.push(req.postDataJSON());
      state.request = { ...state.request, status: "Released", inventoryReleased: true, requestVersion: 4, releasedBy: "test-staff", releasedAt: "2099-01-01T02:30:00Z", releaseType: "Complete", reportingPolicy: { reporting },
        releasedItems: [{ inventoryId: "tree-1", species: "Narra", requestedQuantity: 2, releasedQuantity: 2, difference: 0 }] };
      return route.fulfill({ json: { success: true, data: state.request } }); }, ...overrides });
  await page.goto("/staff/requests?role=staff");
  await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click();
  return { fixture, state };
}
async function releaseAll(page) {
  await page.getByRole("button", { name: "Release Seedlings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Release seedlings", exact: true });
  await expect(dialog).toContainText("Walk-in Citizen");
  await dialog.getByLabel("Available Release Date").fill("2099-01-01"); await dialog.getByLabel("Actual Released Quantity *").fill("2");
  await dialog.getByRole("button", { name: "Confirm Release", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test("the Staff encoder releases an approved walk-in through the existing modal, then submits its required planting report", async ({ page }) => {
  const { fixture, state } = await openWalkIn(page, walkInApproved(), "REQUIRED", {
    "GET /api/planting-reports/official/options": route => route.fulfill({ json: { success: true, data: { options: [{ ...releaseOption, requestId: "staff-own-request", reportSubmissionAllowed: true, requesterName: "Walk-in Citizen" }], nextCursor: null } } }) });
  for (const action of ["Review", "Return Request", "Approve", "Reject", "Submit Planting Report"]) await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
  await releaseAll(page);
  expect(state.bodies).toEqual([{ items: [{ inventoryId: "tree-1", releasedQuantity: 2, shortReleaseReason: "" }], availableReleaseDate: "2099-01-01", expectedVersion: 3 }]);
  await expect(page.getByText("Seedlings Released", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Planting Report Required", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Release Seedlings", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/planting-reports\?officialRequest=staff-own-request/);
  const form = page.locator(".pr-official-dialog");
  await expect(form.locator("#official-request")).toHaveValue("staff-own-request"); await expect(form).toContainText("Walk-in Citizen");
  fixture.check();
});

test("a released walk-in whose policy waives the report shows No Planting Report Required and no submission action", async ({ page }) => {
  const { fixture } = await openWalkIn(page, walkInApproved(), "NOT_REQUIRED");
  await releaseAll(page);
  await expect(page.getByText("No Planting Report Required", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Submit Planting Report/ })).toHaveCount(0);
  fixture.check();
});

test("a directly opened release that needs no report explains it and cannot be submitted", async ({ page }) => {
  const fixture = await setup(page, { "GET /api/planting-reports": route => route.fulfill({ json: { success: true, data: [] } }),
    "GET /api/planting-reports/official/options": route => route.fulfill({ json: { success: true, data: { options: [{ ...releaseOption, requestId: "staff-own-request", reportSubmissionAllowed: false, reportingPolicy: { reporting: "NOT_REQUIRED" } }], nextCursor: null } } }) });
  await page.goto("/staff/planting-reports?role=staff&officialRequest=staff-own-request");
  const form = page.locator(".pr-official-dialog");
  await expect(form.getByRole("status").filter({ hasText: "No Planting Report Required." })).toBeVisible();
  await form.locator('button[type="submit"]').click();
  await expect(form.getByText("No Planting Report Required for this released request.", { exact: true })).toBeVisible();
  expect(fixture.calls.filter(call => call.key === "POST /api/planting-reports/official")).toHaveLength(0);
  fixture.check();
});

test("another Staff member's approved walk-in stays releasable", async ({ page }) => {
  const { fixture } = await openWalkIn(page, walkInApproved({ walkIn: { encodedBy: "another-staff", citizenHasAccount: false } }), "REQUIRED");
  await expect(page.getByRole("button", { name: "Release Seedlings", exact: true })).toBeVisible();
  fixture.check();
});

test("the encoder cannot decide a replacement schedule inside the release modal", async ({ page }) => {
  const { fixture } = await openWalkIn(page, walkInApproved({ lateReleaseRescheduling: { status: "PendingStaffReview", version: 1, availableReleaseDate: "2099-01-04", requesterProposal: { proposalVersion: 1, plantingDate: "2099-01-05", startTime: "08:00" } } }), "REQUIRED");
  await page.getByRole("button", { name: "Release Seedlings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Release seedlings", exact: true });
  await expect(dialog).toContainText("Another authorized MENRO officer must decide the requester's replacement schedule before release.");
  await expect(dialog.getByRole("button", { name: "Return for Revision" })).toHaveCount(0);
  fixture.check();
});

// Staff-submitted requests (own or encoded walk-in) are stored "Reviewed" with submissionPath STAFF_DIRECT_TO_ADMIN:
// Awaiting Approval, no Staff review, Admin decides directly. Participant requests keep Staff review first.
const staffDirect = (extra = {}) => ({ ...ownRequest("Reviewed", "walkin-citizen"), participantName: "Walk-in Citizen", requesterRole: "walk-in", createdByRole: "staff",
  submissionPath: "STAFF_DIRECT_TO_ADMIN", staffReviewRequired: false, reviewStatus: "Not Required", submittedByUid: "test-staff", submittedByName: "Encoding Staff",
  walkIn: { encodedBy: "test-staff", encodedByName: "Encoding Staff", citizenHasAccount: false }, ...extra });
const submissionSection = page => page.locator("[data-submission-path=\"STAFF_DIRECT_TO_ADMIN\"]");

test("Admin sees Approve and Reject for a Staff-submitted walk-in awaiting approval, with no invented Staff review", async ({ page }) => {
  let request = staffDirect(); const bodies = [];
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }),
    "PATCH /api/seedling-requests/staff-own-request/approve": (route, req) => { bodies.push(req.postDataJSON()); request = { ...request, status: "Approved", requestVersion: 4, approvedBy: "test-admin" }; return route.fulfill({ json: { success: true, data: request } }); } });
  await page.goto("/admin/requests?role=admin");
  await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click();
  const submission = submissionSection(page);
  await expect(submission).toContainText("Staff Submission"); await expect(submission).toContainText("Encoding Staff");
  await expect(submission).toContainText("Staff-encoded walk-in request"); await expect(submission).toContainText("Not Required"); await expect(submission).toContainText("Directly to Admin approval");
  await expect(submission).toContainText("Awaiting Approval");
  await expect(page.getByText("MENRO Staff Review", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const modal = page.locator(".sr-decision-modal");
  await expect(modal).toContainText("Staff-submitted · Staff review not required");
  await expect(modal.locator(".sr-site-verification")).toHaveCount(0);
  await modal.getByRole("button", { name: "Confirm Approval", exact: true }).click(); await expect(modal).toHaveCount(0);
  expect(bodies).toEqual([{ expectedVersion: 3 }]); expect(request.status).toBe("Approved");
  // After the decision the submission section no longer claims Awaiting Approval.
  await expect(submissionSection(page)).toBeVisible(); await expect(submissionSection(page)).not.toContainText("Awaiting Approval");
  fixture.check();
});

test("Admin rejects a Staff-submitted request with a required reason through the existing confirmation", async ({ page }) => {
  let request = staffDirect({ walkIn: undefined, participantId: "test-staff", participantName: "Staff Requester", requesterRole: "staff" }); const bodies = [];
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }),
    "PATCH /api/seedling-requests/staff-own-request/reject": (route, req) => { bodies.push(req.postDataJSON()); request = { ...request, status: "Rejected", requestVersion: 4, decisionReason: req.postDataJSON().reason }; return route.fulfill({ json: { success: true, data: request } }); } });
  await page.goto("/admin/requests?role=admin");
  await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click();
  await expect(submissionSection(page)).toContainText("Staff request");
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  const modal = page.locator(".sr-decision-modal");
  await expect(modal.getByRole("button", { name: "Confirm Rejection", exact: true })).toBeDisabled();
  await modal.locator("textarea").fill("Species not available this season");
  await modal.getByRole("button", { name: "Confirm Rejection", exact: true }).click(); await expect(modal).toHaveCount(0);
  expect(bodies).toEqual([{ reason: "Species not available this season", expectedVersion: 3 }]); fixture.check();
});

test("Admin verifies a Staff-submitted proposed site's area and capacity in the approval modal before approving", async ({ page }) => {
  const request = staffDirect({ workflow: { ...ownRequest().workflow, siteMode: "proposed", existingSiteId: "", areaChoice: "", siteReviewRequired: true, siteName: "Proposed fixture site", latitude: 12.6598, longitude: 123.918 },
    eventProposal: { ...ownRequest().eventProposal, plantingSiteId: "PROPOSED" } });
  const bodies = [];
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }),
    "PATCH /api/seedling-requests/staff-own-request/approve": (route, req) => { bodies.push(req.postDataJSON());
      if (bodies.length === 1) return route.fulfill({ status: 400, json: { success: false, message: "Enter the Staff-verified proposed site area and capacity.", fieldErrors: { verifiedMaximumCapacity: "Enter the verified capacity as a positive whole number." } } });
      return route.fulfill({ json: { success: true, data: { ...request, status: "Approved", requestVersion: 4 } } }); } });
  await page.goto("/admin/requests?role=admin");
  await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const modal = page.locator(".sr-decision-modal");
  await expect(modal.getByText("Site Verification", { exact: true })).toBeVisible();
  await modal.getByRole("button", { name: "Confirm Approval", exact: true }).click();
  await expect(modal.getByLabel("Verified Planting Area (Hectares) *")).toHaveAttribute("aria-invalid", "true"); expect(bodies).toHaveLength(0);
  await modal.getByLabel("Verified Planting Area (Hectares) *").fill("0.8");
  await modal.getByLabel("Verified Site Capacity (Seedlings) *").fill("600");
  await modal.getByRole("button", { name: "Confirm Approval", exact: true }).click();
  await expect(modal.getByLabel("Verified Site Capacity (Seedlings) *")).toHaveAttribute("aria-invalid", "true");
  await modal.getByRole("button", { name: "Confirm Approval", exact: true }).click(); await expect(modal).toHaveCount(0);
  expect(bodies.at(-1)).toEqual({ expectedVersion: 3, siteVerification: { areaHectares: "0.8", maximumCapacity: "600" } }); fixture.check();
});

test("Participant requests still need Staff review: Admin has no decision buttons while Pending Review; Staff cannot review a Staff-submitted request", async ({ page }) => {
  const participant = { ...ownRequest("Pending", "test-participant"), requestNumber: "REQ-2099-002", id: "participant-request", participantName: "Participant Requester", requesterRole: "participant", submissionPath: "PARTICIPANT_STAFF_REVIEW" };
  const direct = staffDirect({ id: "direct-request", requestNumber: "REQ-2099-003", walkIn: { encodedBy: "another-staff", citizenHasAccount: false }, submittedByUid: "another-staff" });
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [participant, direct] } }) });
  await page.goto("/admin/requests?role=admin");
  await page.getByRole("button", { name: "View details for REQ-2099-002", exact: true }).click();
  for (const action of ["Approve", "Reject"]) await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
  await page.goto("/staff/requests?role=staff");
  await page.getByRole("button", { name: "View details for REQ-2099-003", exact: true }).click();
  await expect(submissionSection(page)).toBeVisible();
  for (const action of ["Review", "Return Request", "Approve", "Reject"]) await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
  expect(fixture.calls.filter(call => call.key.startsWith("PATCH"))).toHaveLength(0); fixture.check();
});

test("Staff My Requests filter includes their own requests and walk-ins they encoded, never another Staff member's", async ({ page }) => {
  const own = { ...ownRequest("Reviewed", "test-staff"), id: "own", requestNumber: "REQ-2099-010", submissionPath: "STAFF_DIRECT_TO_ADMIN", submittedByUid: "test-staff" };
  const encoded = staffDirect({ id: "encoded", requestNumber: "REQ-2099-011" });
  const historicalEncoded = { ...ownRequest("Pending", "walkin-old"), id: "historical", requestNumber: "REQ-2099-012", participantName: "Historical Citizen", walkIn: { encodedBy: "test-staff", citizenHasAccount: false } };
  const others = staffDirect({ id: "others", requestNumber: "REQ-2099-013", walkIn: { encodedBy: "another-staff", citizenHasAccount: false }, submittedByUid: "another-staff" });
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [own, encoded, historicalEncoded, others] } }) });
  await page.goto("/staff/requests?role=staff");
  for (const number of ["REQ-2099-010", "REQ-2099-011", "REQ-2099-012", "REQ-2099-013"]) await expect(page.getByRole("button", { name: `View details for ${number}`, exact: true })).toBeVisible();
  await page.getByLabel("My Requests", { exact: true }).check();
  for (const number of ["REQ-2099-010", "REQ-2099-011", "REQ-2099-012"]) await expect(page.getByRole("button", { name: `View details for ${number}`, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "View details for REQ-2099-013", exact: true })).toHaveCount(0);
  fixture.check();
});

test("Staff My Requests page lists an encoded walk-in for the citizen and routes walk-in actions to the walk-in tools", async ({ page }) => {
  const returned = staffDirect({ id: "walkin-returned", requestNumber: "REQ-2099-020", status: "Returned", returnReason: "Clarify the site", submissionPath: undefined });
  const awaitingSchedule = staffDirect({ id: "walkin-schedule", requestNumber: "REQ-2099-021", status: "Pending", submissionPath: undefined, preApprovalSchedule: { status: "AwaitingRequesterConfirmation", plantingDate: "2099-01-03", startTime: "09:00", proposalVersion: 1 } });
  const fixture = await setup(page, { "GET /api/seedling-requests/my": route => route.fulfill({ json: { success: true, data: [returned, awaitingSchedule] } }),
    "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [returned, awaitingSchedule] } }) });
  await page.goto("/staff/my-requests?role=staff");
  await expect(page.locator(".myr-walkin-note").first()).toHaveText("Walk-in for Walk-in Citizen");
  await page.getByRole("button", { name: "View details of REQ-2099-021", exact: true }).click();
  await expect(page.locator("[data-walkin-schedule-action]")).toContainText("signed schedule acknowledgement");
  await expect(page.getByRole("heading", { name: "Confirm Coordinated Planting Schedule" })).toHaveCount(0);
  await page.locator("[data-walkin-schedule-action]").getByRole("button", { name: "Open in Seedling Requests" }).click();
  await expect(page).toHaveURL(/\/staff\/requests\?request=walkin-schedule/);
  await page.goto("/staff/my-requests?role=staff");
  await page.getByRole("button", { name: "View details of REQ-2099-020", exact: true }).click();
  await page.getByRole("button", { name: "Edit Request", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/walk-in-requests\/new\?edit=walkin-returned/);
  expect(fixture.calls.filter(call => call.key.startsWith("PATCH"))).toHaveLength(0); fixture.check();
});

test("Participant report options come only from their own releases and a lost release clears only what depends on it", async ({ page }) => {
  const sites = [site, { ...site, id: "site-2", siteName: "Other requester site", barangay: "Calomagon" }];
  const event = (id, siteId, extra = {}) => ({ id, name: id, type: "Tree Planting", plantingSiteId: siteId, sourceRequestId: id.replace("event", "request"), date: "2026-01-01", startTime: "08:00", status: "Approved", recordStatus: "Authorized", ...extra });
  const release = { id: "release-own", requestId: "request-own", eventId: "event-own", plantingSiteId: site.id, participantId: "test-participant", status: "Released", items: [{ inventoryId: "narra", species: "Narra", releasedQuantity: 5, quantity: 5 }] };
  let releases = [release];
  const fixture = await setup(page, {
    "GET /api/sites": route => route.fulfill({ json: { success: true, data: sites } }),
    "GET /api/events": route => route.fulfill({ json: { success: true, data: [event("event-own", site.id), event("event-shared", site.id), event("event-other", "site-2")] } }),
    "GET /api/distributions/my-distributions": route => route.fulfill({ json: { success: true, data: releases } }),
  });
  await page.goto("/participant/my-planting-reports?role=participant");
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  const values = id => page.locator(`#planting-${id} option`).evaluateAll(options => options.map(option => option.value).filter(Boolean));
  await expect.poll(() => values("barangay")).toEqual(["Bical"]);
  await page.locator("#planting-barangay").selectOption("Bical"); expect(await values("siteId")).toEqual([site.id]);
  await page.locator("#planting-siteId").selectOption(site.id); expect(await values("eventId")).toEqual(["event-own"]);
  await page.locator("#planting-eventId").selectOption("event-own"); expect(await values("distributionId")).toEqual(["release-own"]);
  await page.locator("#planting-distributionId").selectOption("release-own");
  await page.locator("#planting-submittedByName").fill("Kept name");
  // The release was reported elsewhere: the refreshed list no longer offers it.
  releases = [];
  await page.locator("button.pr-secondary-button", { hasText: "Reset" }).first().dispatchEvent("click");
  await expect(page.locator("#planting-barangay")).toHaveValue(""); await expect(page.locator("#planting-siteId")).toHaveValue(""); await expect(page.locator("#planting-distributionId")).toHaveValue("");
  await expect(page.locator("#planting-submittedByName")).toHaveValue("Kept name"); expect(await values("barangay")).toEqual([]);
  await expect(page.getByText("You have no released seedlings awaiting a planting report.")).toBeVisible();
  fixture.check();
});

const formValues = page => page.evaluate(() => Object.fromEntries(["submittedByName", "barangay", "siteId", "eventId", "distributionId"].map(id => [id, document.querySelector(`#planting-${id}`)?.value])));
const keptValues = { submittedByName: "Fixture requester", barangay: "Bical", siteId: site.id, eventId: "event-1", distributionId: "release-1" };
test("an interrupted report form keeps its entries and verified photo: Escape, a dialog closed by the phone, and a cancelled camera", async ({ page }) => {
  const fixture = await participantEvidenceForm(page); await reportIdentity(page); await takeFixturePhoto(page); await expect(cameraEvidence(page)).toBeVisible();
  await page.getByRole("button", { name: "Take Photo", exact: true }).click(); await page.keyboard.press("Escape");
  expect(await formValues(page)).toMatchObject(keptValues); await expect(cameraEvidence(page)).toBeVisible();
  for (const interrupt of [() => page.keyboard.press("Escape"), () => page.evaluate(() => document.querySelector('dialog[aria-label="Submit Planting Report"]').close())]) {
    await interrupt();
    await expect(page.getByRole("dialog", { name: "Submit Planting Report" })).toHaveCount(0);
    await expect(page.getByText("Your unfinished planting report was kept.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
    expect(await formValues(page)).toMatchObject(keptValues); await expect(cameraEvidence(page)).toBeVisible();
  }
  // Cancel is a decision to discard.
  await page.getByRole("dialog", { name: "Submit Planting Report" }).getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click(); expect((await formValues(page)).submittedByName).toBe("");
  fixture.check();
});
test("a reloaded page restores typed entries only, says photos must be added again, and stores no photo or location", async ({ page }) => {
  const fixture = await participantEvidenceForm(page); await reportIdentity(page); await takeFixturePhoto(page); await expect(cameraEvidence(page)).toBeVisible();
  await page.waitForTimeout(400);
  const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
  expect(stored).toContain("participant-draft"); expect(stored).not.toMatch(/latitude|longitude|data:image|blob:|captureSession|nonce/);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Submit Planting Report" })).toBeVisible();
  await expect.poll(() => formValues(page)).toMatchObject(keptValues);
  await expect(page.getByText("please add them again", { exact: false }).first()).toBeVisible(); await expect(page.getByText(/0 \/ 10 photos selected/)).toBeVisible();
  await page.getByRole("dialog", { name: "Submit Planting Report" }).getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => Object.keys(sessionStorage).some(key => key.includes("participant-draft")))).toBe(false);
  await page.reload(); await expect(page.getByRole("button", { name: "Submit Planting Report", exact: true })).toBeVisible(); await expect(page.getByRole("dialog", { name: "Submit Planting Report" })).toHaveCount(0);
  fixture.check();
});
test("unsupported and corrupted photos are named as such, never as missing GPS", async ({ page }) => {
  const fixture = await participantEvidenceForm(page);
  const input = page.getByLabel("Planting evidence photos"), label = page.locator(".pr-preview-verification strong");
  await input.setInputFiles({ name: "renamed.jpg", mimeType: "image/jpeg", buffer: Buffer.from("this is not a photo") });
  await expect(label.filter({ hasText: "Unsupported Format" })).toBeVisible(); await expect(uploadFailure(page)).toHaveCount(0);
  await input.setInputFiles({ name: "clip.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(page.getByText("The photo format could not be processed.", { exact: false }).last()).toBeVisible();
  fixture.check();
});
test("an original HEIC photo is shown and read in a browser without HEIC support", async ({ page }) => {
  const fixture = await participantEvidenceForm(page);
  await page.getByLabel("Planting evidence photos").setInputFiles(new URL("../fixtures/real-photos/heic-single.heic", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  await expect.poll(() => page.getByAltText("Planting evidence preview 1").evaluate(element => element.naturalWidth), { timeout: 30000 }).toBeGreaterThan(500);
  // It has no GPS: it says so, and not that the file is unreadable.
  await expect(uploadFailure(page)).toBeVisible(); await expect(page.locator(".pr-preview-verification strong").filter({ hasText: /Unreadable|Unsupported/ })).toHaveCount(0);
  fixture.check();
});
