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
    else if (key.startsWith("GET ") && /^\/api\/planting-reports\/[^/]+\/verification-logs$/.test(url.pathname)) data = [];
    else if (key === "POST /api/seedling-requests") data = { id: "new-request", requestNumber: "REQ-FIXTURE" };
    else { unexpected.push(key); return route.fulfill({ status: 500, json: { success: false, message: "Unregistered test request" } }); }
    return route.fulfill({ json: { success: true, data } });
  });
  return { calls, check() { expect(unexpected).toEqual([]); expect(external.filter(origin => !/cartocdn|openstreetmap/.test(origin))).toEqual([]); } };
}
async function requester(page, { role = "participant", navigate = true, heading = "Request Seedlings", sector = "Resident / Individual", detail } = {}) {
  if (navigate) await page.goto(`/${role}/request-seedlings?role=${role}`);
  await expect(page.getByRole("heading", { name: role === "staff" ? "Submit Seedling Request" : heading, exact: true })).toBeVisible();
  await page.getByLabel("Requesting As *", { exact: true }).selectOption(sector);
  if (detail) await page.getByLabel(detail.label, { exact: true }).fill(detail.value);
  await page.getByLabel("Province *", { exact: true }).selectOption("Sorsogon");
  await page.getByLabel("Municipality / City *", { exact: true }).selectOption("Bulan");
  await page.getByLabel("Barangay *", { exact: true }).selectOption("Bical");
  await page.getByLabel("Street / Purok / Sitio *").fill("Fixture street");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Purpose of Request *").selectOption("Household / Backyard");
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
  await page.getByRole("button", { name: "Take Photo", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
  await expect(page.getByText("Backend-verified camera capture", { exact: true })).toBeVisible();
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
  await page.getByLabel("Final Leftover Seedlings (Not Planted)").fill("2");
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
  await expect(page.getByRole("alert").filter({ hasText: "Add and verify original" })).toBeVisible();
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
  await expect(page.getByText(/The report is saved pending Admin verification/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Take Photo", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Upload Evidence for Saved Report", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Submit Official Planting Report", exact: true })).toHaveCount(0);
  expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]);
  expect(fixture.calls.filter(call => call.key === "POST /api/planting-reports/official")).toHaveLength(1); fixture.check();
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
  await expect(page.locator(".menro-toast-viewport-floating")).toHaveCSS("position", "fixed");
  const topbar = page.locator(".topbar"); const before = await topbar.boundingBox();
  await page.getByRole("button", { name: "Dismiss Login Successful", exact: true }).click();
  await expect(toast).toHaveCount(0); expect(await topbar.boundingBox()).toEqual(before);
  await page.reload(); await expect(page.getByText("Login Successful", { exact: true })).toHaveCount(0);
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
  await expect(page.getByText("Planting Care Information", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel(/Who will be responsible|How often do you plan|How will you care/)).toHaveCount(0);
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
  for (const field of ["caretaker", "carePlan", "monitoringFrequency", "monitoringOther"]) expect(submission.workflow).not.toHaveProperty(field);
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

test("Participant form retains planting fields and traps keyboard focus with optional attendance", async ({ page }) => {
  const fixture = await setup(page);
  await page.goto("/participant/my-planting-reports?role=participant");
  const trigger = page.getByRole("button", { name: "Submit Planting Report", exact: true }); await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Submit Planting Report", exact: true }); await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Final Leftover Seedlings (Not Planted)", { exact: true })).toHaveValue("0");
  await expect(page.locator("#planting-quantity")).toHaveAttribute("readonly");
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
  await page.getByRole("button", { name: "Next", exact: true }).click();
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

test("Staff reviews an Other-purpose request without a policy proposal and Admin makes the versioned final decision", async ({ page }) => {
  let request = { ...ownRequest("Pending", "citizen-requester"), purposePolicyManaged: true, purpose: "Habitat activity", purposePolicyCandidate: { purpose: "Other", policyVersion: 0 }, workflow: { ...ownRequest().workflow, purpose: "Other", purposeOther: "Habitat activity" } };
  let reviewed = false, approved;
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [request] } }),
    "GET /api/purpose-policies": route => route.fulfill({ json: { success: true, data: { version: 5, purposes: [{ purpose: "Other", reporting: "CONDITIONAL", monitoring: "NONE", quantityThreshold: null }] } } }),
    "PATCH /api/seedling-requests/staff-own-request/review": (route, req) => { expect(req.postDataJSON()).not.toHaveProperty("policyProposal"); reviewed = true; request = { ...request, status: "Reviewed", requestVersion: 4 }; return route.fulfill({ json: { success: true, data: request } }); },
    "PATCH /api/seedling-requests/staff-own-request/approve": (route, req) => { approved = req.postDataJSON(); expect(approved.expectedVersion).toBe(4); expect(approved.policyDecision.expectedPolicyVersion).toBe(5);
      if (!approved.policyDecision.reason) return route.fulfill({ status: 400, json: { success: false, message: "A policy decision reason is required.", fieldErrors: { policyReason: "Record the Admin reason." } } });
      request = { ...request, status: "Approved", requestVersion: 5 }; return route.fulfill({ json: { success: true, data: request } });
    } });
  await page.goto("/staff/requests?role=staff"); await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click(); await page.getByRole("button", { name: "Review", exact: true }).click();
  const reviewDialog = page.locator(".sr-decision-modal").filter({ has: page.getByRole("heading", { name: "Review Seedling Request", exact: true }) });
  await expect(reviewDialog).toBeVisible();
  await expect(reviewDialog.getByText("Staff Policy Proposal", { exact: false })).toHaveCount(0);
  await expect(reviewDialog.getByLabel("Reporting Requirement")).toHaveCount(0); await expect(reviewDialog.getByLabel("Monitoring Requirement")).toHaveCount(0); await expect(reviewDialog.getByLabel("Policy Decision Reason")).toHaveCount(0);
  await page.getByRole("button", { name: "Complete Review", exact: true }).click(); await expect(page.getByRole("button", { name: "Complete Review", exact: true })).toHaveCount(0); expect(reviewed).toBe(true);
  await page.goto("/admin/requests?role=admin"); await page.getByRole("button", { name: "View details for REQ-2099-001", exact: true }).click(); await page.getByRole("button", { name: "Approve", exact: true }).click();
  const adminPolicy = page.getByRole("group", { name: "Admin Final Purpose Policy", exact: true });
  await adminPolicy.getByLabel("Reporting Requirement").selectOption("REQUIRED"); await adminPolicy.getByLabel("Monitoring Requirement").selectOption("PERMANENT_SAMPLE");
  await page.getByRole("button", { name: "Confirm Approval", exact: true }).click(); await expect(page.getByText("A policy decision reason is required.", { exact: true })).toBeVisible();
  await adminPolicy.getByLabel("Policy Decision Reason").fill("Admin confirms the documented reporting and monitoring requirement"); await page.getByRole("button", { name: "Confirm Approval", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm Approval", exact: true })).toHaveCount(0); expect(request.status).toBe("Approved"); fixture.check();
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

test("My Requests ownership filter combines with Replacement without including assisted citizens", async ({ page }) => {
  const records = [
    { ...ownRequest(), id: "mine-new", requestNumber: "REQ-2099-101", requestType: "New Planting" },
    { ...ownRequest(), id: "mine-replacement", requestNumber: "REQ-2099-102", requestType: "Replacement" },
    { ...ownRequest("Pending", "citizen"), id: "assisted", requestNumber: "REQ-2099-103", requestType: "Replacement", walkIn: { encodedBy: "test-staff" } },
  ];
  const fixture = await setup(page, { "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: records } }) });
  await page.goto("/staff/requests?role=staff");
  await expect(page.getByRole("button", { name: "Encode Walk-in Request", exact: true })).toHaveCount(0);
  await expect(page.locator(".sr-header-actions").getByRole("button", { name: "My Requests", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "My Requests", exact: true }).check();
  await expect(page.getByRole("button", { name: "View details for REQ-2099-103", exact: true })).toHaveCount(0);
  await page.locator("select").filter({ has: page.locator('option[value="Replacement"]') }).selectOption("Replacement");
  await expect(page.getByRole("button", { name: "View details for REQ-2099-102", exact: true })).toBeVisible();
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

for (const role of ["staff", "admin"]) test(`${role} accesses verified records inside reports and sampling inside monitoring`, async ({ page }) => {
  const cohort = { id: "VPC-fixture", verifiedPlantedQuantity: 10, source: { plantingReportId: "report-1", siteId: "site-1" }, samplingPolicySnapshot: { percentage: 10 }, samplingReadiness: { target: null, pending: ["approved minimum"] }, samplingPlan: { status: "DRAFT", version: 0 } };
  const fixture = await setup(page, { "GET /api/verified-planting-cohorts": route => route.fulfill({ json: { success: true, data: [cohort] } }) });
  await page.goto(`/${role}/planting-reports?role=${role}`);
  await page.getByRole("button", { name: "Verified Planting Cohorts", exact: true }).click();
  await page.getByLabel("Verified cohort", { exact: true }).selectOption(cohort.id);
  await expect(page.getByRole("heading", { name: "Verified planting record", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View source planting report", exact: true })).toHaveAttribute("href", "/" + role + "/planting-reports?report=report-1");
  await expect(page.getByRole("link", { name: "View registered planting site", exact: true })).toHaveAttribute("href", "/" + role + "/planting-sites?site=site-1");
  await expect(page.getByRole("heading", { name: "Sampling Plan", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await expect(page.getByRole("link", { name: "Verified Planting Records", exact: true })).toHaveCount(0);
  await page.goto(`/${role}/survival-monitoring?role=${role}`);
  await page.getByRole("button", { name: "Permanent Sample Selection and Baselines", exact: true }).click();
  await page.getByLabel("Verified cohort", { exact: true }).selectOption(cohort.id);
  await expect(page.getByText(/MENRO decisions pending: approved minimum/)).toBeVisible();
  if (role === "staff") await expect(page.getByRole("button", { name: "Submit plan for approval", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Create Visit/ })).toHaveCount(0);
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

for (const role of ["admin", "staff", "participant"]) for (const width of [320, 360, 390, 430, 768, 1440]) test(role + " populated coverage stays within " + width + "px", async ({ page }) => {
  const request = { ...ownRequest("Released", role === "participant" ? "test-participant" : "test-staff"), reportingPolicy: { reporting: "REQUIRED" }, releasedItems: [{ releasedQuantity: 10 }] };
  await setup(page, Object.fromEntries(["/api/seedling-requests", "/api/seedling-requests/my", "/api/seedling-requests/my-requests"].map(path => ["GET " + path, route => route.fulfill({ json: { success: true, data: [request] } })])));
  await page.setViewportSize({ width, height: 900 }); await page.goto("/" + role + "/dashboard?role=" + role);
  await expect(page.locator(".dashboard-kpi-grid")).toBeVisible();
  if (role !== "participant") await expect(page.locator(".reporting-coverage")).toHaveCount(0);
  else { await expect(page.getByRole("region", { name: "Planting reporting coverage" })).toBeVisible(); await expect(page.locator(".reporting-coverage table")).toContainText(request.requestNumber); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
test("sampling action wraps at 320px without clipping", async ({ page }) => {
  await setup(page); await page.setViewportSize({ width: 320, height: 900 }); await page.goto("/staff/survival-monitoring?role=staff");
  const button = page.getByRole("button", { name: "Permanent Sample Selection and Baselines", exact: true });
  expect(await button.evaluate(node => getComputedStyle(node).whiteSpace)).toBe("normal");
  expect(await button.evaluate(node => node.getBoundingClientRect().right)).toBeLessThanOrEqual(320);
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
async function participantEvidenceForm(page) {
  const event = { id: "event-1", name: "event-1", type: "Tree Planting", plantingSiteId: site.id, sourceRequestId: "request-1", date: "2026-01-01", startTime: "08:00", status: "Approved", recordStatus: "Authorized" };
  const release = { id: "release-1", requestId: "release-1", eventId: "event-1", plantingSiteId: site.id, participantId: "test-participant", status: "Released", items: [{ inventoryId: "narra", species: "Narra", releasedQuantity: 5, quantity: 5 }] };
  const fixture = await setup(page, {
    "GET /api/events": route => route.fulfill({ json: { success: true, data: [event] } }),
    "GET /api/distributions/my-distributions": route => route.fulfill({ json: { success: true, data: [release] } }),
    "POST /api/evidence-capture-sessions": route => route.fulfill({ json: { success: true, data: { captureSessionId: "mixed-session", nonce: "fixture-only" } } }),
    "POST /api/evidence-capture-sessions/mixed-session/verify": route => route.fulfill({ json: { success: true, data: { verificationId: "verified", imageSha256: "digest", location: { latitude: site.latitude, longitude: site.longitude, accuracy: 12 } } } }),
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
  await expect(page.getByText(/This original photo has no GPS metadata/)).toBeVisible();
  await expect(page.getByText("Backend-verified camera capture", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(page.getByText("Add and verify original planting photos for the MENRO Field Report.")).toBeVisible();
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
async function reviewFixture(page, current, overrides = {}) {
  const list = route => route.fulfill({ json: { success: true, data: [current()] } });
  const photos = {};
  for (let index = 0; index < 4; index += 1) photos[`GET /api/evidence/planting-reports/report-review/photos/${index}`] = route => route.fulfill({ status: 200, contentType: "image/png", body: reviewPng });
  return setup(page, { "GET /api/planting-reports": list, "GET /api/planting-reports/my-reports": list,
    "GET /api/planting-reports/report-review/verification-logs": route => route.fulfill({ json: { success: true, data: [] } }), ...photos, ...overrides });
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
  await expect(card.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Forward to Admin", exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Return for Correction", exact: true }).click();
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
  await expect(card.getByRole("button", { name: "Forward to Admin", exact: true })).toHaveCount(0);
  await expect(page.locator(".pr-report-drawer .menro-toast").getByText("Planting report returned for correction.")).toBeVisible();
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
  await card.getByRole("button", { name: "Forward to Admin", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Forward to Admin for Approval?", exact: true });
  await expect(dialog.getByText("(optional)")).toBeVisible();
  await dialog.getByRole("button", { name: "Forward to Admin", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const badge = card.locator('[data-workflow-status="Reviewed"]');
  await expect(badge).toBeVisible(); await expect(badge).toHaveClass(/pr-status-reviewed/);
  await expect(card.getByText("Awaiting MENRO Admin approval.", { exact: true })).toBeVisible();
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
  await expect(waiting.getByText("Awaiting MENRO Staff review before Admin approval.", { exact: true })).toBeVisible();
  for (const action of ["Approve", "Reject", "Forward to Admin", "Return for Correction"]) await expect(waiting.getByRole("button", { name: action, exact: true })).toHaveCount(0);
  const card = page.getByRole("article", { name: "Submission sub-reviewed" });
  await expect(card.getByRole("button", { name: "Return for Correction", exact: true })).toHaveCount(0);
  await expect(card.getByText("Photos match the site", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Submission and decision history" }).getByText("Staff Review — Forwarded to Admin")).toBeVisible();
  await card.getByRole("button", { name: "Reject", exact: true }).click();
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
  await expect(card.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
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
  for (const action of ["Approve", "Reject", "Return for Correction"]) await expect(card.getByRole("button", { name: action, exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Forward to Admin", exact: true })).toHaveCount(0);
  await card.getByRole("button", { name: "Approve", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Approve Planting Report?", exact: true });
  await expect(dialog.getByText("marks this submission Completed", { exact: false })).toBeVisible();
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
  for (const action of ["Forward to Admin", "Return for Correction", "Approve", "Reject"]) await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
  await page.getByRole("article", { name: "Submission sub-own-returned" }).getByRole("button", { name: "Correct and Resubmit", exact: true }).click();
  const banner = page.getByRole("note", { name: "Correction details" });
  await expect(banner).toContainText("Retake the photo inside the site");
  await expect(banner).toContainText("Narra");
  fixture.check();
});
