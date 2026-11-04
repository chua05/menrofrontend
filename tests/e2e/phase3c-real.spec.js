import { expect, test } from "@playwright/test";
import process from "node:process";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const authOrigin = process.env.MENRO_PHASE3C_ISOLATED_EMULATORS === "true"
  ? "http://127.0.0.1:9299"
  : "http://127.0.0.1:9099";
const origins = new Set(["http://127.0.0.1:5186", "http://127.0.0.1:5185", authOrigin]);
let unexpectedOrigins = [];
test.beforeEach(() => { unexpectedOrigins = []; });
test.afterEach(() => { expect(unexpectedOrigins, "Unapproved browser network requests").toEqual([]); });
const fixture = () => readFile(path.join(os.tmpdir(), "menro-phase3c-browser-fixture.json"), "utf8").then(JSON.parse);
test.afterAll(async () => {
  if (process.env.MENRO_PHASE3C_FAKE_VIDEO_PATH) await rm(process.env.MENRO_PHASE3C_FAKE_VIDEO_PATH, { force: true }).catch(() => undefined);
});
async function isolate(page) { await page.route("**/*", (route) => {
  const origin = new URL(route.request().url()).origin;
  if (origins.has(origin)) return route.continue();
  unexpectedOrigins.push(origin);
  return route.abort();
}); }
async function login(page, role, route, beforeSubmit = () => {}) {
  const data = await fixture();
  await page.goto(route);
  await expect(page.locator("#login-email")).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });
  await page.locator("#login-email").fill(data.emails[role]);
  await page.locator("#login-password").fill(data.password);
  beforeSubmit();
  await page.locator("button.login-primary-btn").click();
}
function discoveryResponse(page) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "GET" && url.origin === "http://127.0.0.1:5185" && url.pathname === "/api/verified-sample-monitoring/visits";
  }, { timeout: 15000 });
}
async function openAuthorizedVisit(page, role, route) {
  const data = await fixture();
  let discovery;
  await login(page, role, route, () => { discovery = discoveryResponse(page); });
  const response = await discovery;
  const body = await response.json().catch(() => null);
  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body?.data?.visits?.some((visit) => visit.id === data.visitId), JSON.stringify(body)).toBeTruthy();
  const visit = page.getByRole("button", { name: data.visitId, exact: true });
  await expect(visit).toBeVisible({ timeout: 15000 });
  await visit.click();
  return data;
}
test("Staff signs in through the Auth Emulator and opens an authoritative existing visit", async ({ page }) => {
  const api = []; page.on("request", (request) => { if (request.url().startsWith("http://127.0.0.1:5185/api/")) api.push(request.url()); }); await isolate(page);
  await openAuthorizedVisit(page, "staff", "/staff/permanent-sample-monitoring"); await expect(page).toHaveURL(/\/staff\/permanent-sample-monitoring$/); await expect(page.getByText("TREE-001").first()).toBeVisible();
  expect(api.some((url) => url.includes("/verified-sample-monitoring/visits"))).toBeTruthy();
});
test("unauthenticated, Participant and non-owner Staff access is denied", async ({ browser, page }) => {
  test.setTimeout(60000);
  await isolate(page); await page.goto("/staff/permanent-sample-monitoring"); await expect(page).toHaveURL(/\/login$/);
  const participant = await browser.newPage();
  await isolate(participant);
  await login(participant, "participant", "/staff/permanent-sample-monitoring");
  await expect(participant).toHaveURL(/\/(?:participant\/dashboard|complete-profile)$/);
  await participant.goto("/staff/permanent-sample-monitoring");
  await expect(participant).toHaveURL(/\/(?:login|complete-profile)$/);
  await participant.close();
  const nonOwner = await browser.newPage();
  await isolate(nonOwner);
  let nonOwnerDiscovery;
  await login(nonOwner, "otherStaff", "/staff/permanent-sample-monitoring", () => { nonOwnerDiscovery = discoveryResponse(nonOwner); });
  const response = await nonOwnerDiscovery;
  expect(response.status()).toBe(200);
  expect((await response.json()).data.visits).toEqual([]);
  await expect(nonOwner.getByText("No authorized monitoring visits are available.")).toBeVisible();
  const data = await fixture();
  const denied = await nonOwner.evaluate(async visitId => {
    const { authenticatedFetch } = await import("/src/services/authenticatedApi.js");
    const response = await authenticatedFetch(`/verified-sample-monitoring/visits/${visitId}`);
    return { status: response.status, body: await response.json() };
  }, data.visitId);
  expect(denied.status).toBe(404);
  expect(JSON.stringify(denied.body)).not.toMatch(/privateEvidence|objectName|uploadIntentId/);
  await nonOwner.close();
});
test("Admin signs in through the Auth Emulator and can open the authorized monitoring visit", async ({ page }) => {
  await isolate(page); await openAuthorizedVisit(page, "admin", "/admin/permanent-sample-monitoring"); await expect(page).toHaveURL(/\/admin\/permanent-sample-monitoring$/); await expect(page.getByText("TREE-001").first()).toBeVisible();
});
test("Staff captures, verifies, uploads, and retrieves private evidence through the real browser component", async ({ page }) => {
  const api = []; page.on("request", (request) => { if (request.url().startsWith("http://127.0.0.1:5185/api/")) api.push(request.url()); }); await isolate(page);
  await openAuthorizedVisit(page, "staff", "/staff/permanent-sample-monitoring");
  await page.getByRole("button", { name: "Capture verified photo for TREE-001" }).click();
  await page.getByRole("button", { name: /Continue to Camera/ }).click();
  const video = page.locator("video.secure-camera-preview"); await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((node) => node.videoWidth > 0 && node.videoHeight > 0)).toBe(true);
  await page.context().setGeolocation({ latitude: 12.662311, longitude: 123.932993, accuracy: 5 });
  await page.getByRole("button", { name: "Capture", exact: true }).click();
  const verification = page.waitForResponse(response => response.url().includes("/api/evidence-capture-sessions/") && response.url().endsWith("/verify"));
  await page.getByRole("button", { name: /Verify & Use Photo/ }).click();
  const verifiedLocation = (await (await verification).json()).data.location;
  expect(verifiedLocation.latitude).toBe(12.662311);
  expect(verifiedLocation.longitude).toBe(123.932993);
  await expect(page.getByText("Verified photo ready for private upload.")).toBeVisible();
  const upload = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "PUT" && url.origin === "http://127.0.0.1:5185" &&
      url.pathname.endsWith("/samples/TREE-001/evidence");
  });
  await page.getByRole("button", { name: "Upload verified photo for TREE-001" }).click();
  const uploadResponse = await upload;
  const uploadBody = await uploadResponse.json().catch(() => null);
  expect(uploadResponse.status(), JSON.stringify(uploadBody)).toBe(200);
  await expect(page.getByText("Historical evidence revision 0")).toBeVisible();
  await page.getByRole("button", { name: "View private evidence revision 0" }).click();
  await expect(page.getByAltText("Private evidence for TREE-001, revision 0")).toBeVisible();
  expect(api.some((url) => url.includes("/evidence-capture-sessions"))).toBeTruthy();
  expect(api.some((url) => url.includes("/samples/TREE-001/evidence"))).toBeTruthy();
});
async function captureAndUpload(page, minimumVideoTime = 0.2) {
  await page.getByRole("button", { name: "Capture verified photo for TREE-001" }).click();
  await page.getByRole("button", { name: /Continue to Camera/ }).click();
  const video = page.locator("video.secure-camera-preview");
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((node) => node.videoWidth > 0 && node.videoHeight > 0)).toBe(true);
  await expect.poll(() => video.evaluate((node, minimum) => node.currentTime >= minimum, minimumVideoTime)).toBe(true);
  await page.getByRole("button", { name: "Capture", exact: true }).click();
  await page.getByRole("button", { name: /Verify & Use Photo/ }).click();
  const upload = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "PUT" && url.origin === "http://127.0.0.1:5185" &&
      url.pathname.endsWith("/samples/TREE-001/evidence");
  });
  await page.getByRole("button", { name: "Upload verified photo for TREE-001" }).click();
  const response = await upload;
  const body = await response.json().catch(() => null);
  expect(response.status(), JSON.stringify(body)).toBe(200);
}
async function completeAssessment(page, remarks, height = "120") {
  const tree = page.getByRole("group", { name: "TREE-001" });
  await tree.getByLabel("Height (cm)").fill(height);
  await tree.getByLabel("Diameter (cm)").fill("6");
  await tree.getByLabel("Condition").selectOption("Healthy");
  await tree.getByLabel("Remarks").fill(remarks);
  await tree.getByRole("button", { name: "Save TREE-001 Draft" }).click();
  await expect(page.getByText(/DRAFT · version \d+/)).toBeVisible();
}
test("Staff and Admin complete the real returned-correction lifecycle with immutable private evidence", async ({ browser }) => {
  // Four real Auth sessions, two camera sessions and all review transitions;
  // individual discovery/API/UI waits retain their shorter bounds.
  test.setTimeout(120_000);
  const staffContext = await browser.newContext({ permissions: ["camera", "geolocation"], geolocation: { latitude: 12.662301, longitude: 123.932983, accuracy: 5 } });
  const staff = await staffContext.newPage();
  await isolate(staff);
  const data = await openAuthorizedVisit(staff, "staff", "/staff/permanent-sample-monitoring");
  await completeAssessment(staff, "Initial browser evidence.");
  await captureAndUpload(staff, 0.2);
  await expect(staff.getByText("Historical evidence revision 0").first()).toBeVisible();
  await staff.getByRole("button", { name: "Submit Visit" }).click();
  await expect(staff.getByText(/PENDING_ADMIN_APPROVAL · version \d+/)).toBeVisible();

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await isolate(admin);
  await openAuthorizedVisit(admin, "admin", "/admin/permanent-sample-monitoring");
  await expect(admin.getByRole("button", { name: "View private evidence revision 0" }).first()).toBeVisible();
  await admin.getByLabel("Return reason").fill("Please correct the assessment.");
  await admin.getByRole("button", { name: "Return for Correction" }).click();
  await expect(admin.getByText(/RETURNED · version \d+/)).toBeVisible();
  await adminContext.close();

  await staff.reload();
  await staff.getByRole("button", { name: data.visitId, exact: true }).click();
  await expect(staff.getByText(/RETURNED · version \d+/)).toBeVisible();
  await completeAssessment(staff, "Corrected browser evidence.", "121");
  await captureAndUpload(staff, 1.0);
  await expect(staff.getByText("Historical evidence revision 0").first()).toBeVisible();
  await expect(staff.getByText("Historical evidence revision 1").first()).toBeVisible();
  await staff.getByRole("button", { name: "Submit Visit" }).click();
  await expect(staff.getByText(/PENDING_ADMIN_APPROVAL · version \d+/)).toBeVisible();

  const approvingContext = await browser.newContext();
  const approvingAdmin = await approvingContext.newPage();
  await isolate(approvingAdmin);
  await openAuthorizedVisit(approvingAdmin, "admin", "/admin/permanent-sample-monitoring");
  await approvingAdmin.getByRole("button", { name: "View private evidence revision 0" }).first().click();
  await approvingAdmin.getByRole("button", { name: "View private evidence revision 1" }).first().click();
  await expect(approvingAdmin.getByAltText("Private evidence for TREE-001, revision 0")).toBeVisible();
  await expect(approvingAdmin.getByAltText("Private evidence for TREE-001, revision 1")).toBeVisible();
  await approvingAdmin.getByRole("button", { name: "Approve Visit" }).click();
  await expect(approvingAdmin.getByText(/APPROVED · version \d+/)).toBeVisible();
  await expect(approvingAdmin.getByRole("status").filter({ hasText: "Approved visits are read-only." })).toBeVisible();
  await approvingContext.close();

  await staff.reload();
  await staff.getByRole("button", { name: data.visitId, exact: true }).click();
  await expect(staff.getByRole("button", { name: /Save TREE-001 Draft|Submit Visit|Capture verified photo/ })).toHaveCount(0);
  await staffContext.close();
});
