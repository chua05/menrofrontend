import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
const local = new Set(["http://127.0.0.1:5186", "http://127.0.0.1:5185", "http://127.0.0.1:9299"]);
const fixture = () => readFile(path.join(os.tmpdir(), "menro-phase3c-browser-fixture.json"), "utf8").then(JSON.parse);
const unauthorized = [];
test.afterEach(() => { expect(unauthorized).toEqual([]); });
test.afterAll(async () => { if (process.env.MENRO_PHASE3C_FAKE_VIDEO_PATH) await rm(process.env.MENRO_PHASE3C_FAKE_VIDEO_PATH, { force: true }); });
async function isolate(page) {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (local.has(url.origin)) return route.continue();
    // Real map components remain mounted. Background tiles are blocked, never
    // sent to their providers; every other nonlocal request fails acceptance.
    if (!/(^|\.)(tile\.openstreetmap\.org|basemaps\.cartocdn\.com)$/.test(url.hostname)) unauthorized.push(url.origin);
    return route.abort();
  });
}
async function login(page, role) {
  const data = await fixture(); expect(data.project).toBe("demo-menro-phase3c-isolated");
  await isolate(page); await page.goto("/login");
  await page.locator("#login-email").fill(data.emails[role]); await page.locator("#login-password").fill(data.password);
  await page.locator("button.login-primary-btn").click(); await expect(page).toHaveURL(new RegExp(`/${role === "otherStaff" ? "staff" : role}/dashboard$`), { timeout: 20000 });
  return data;
}
async function api(page, endpoint, options = {}) {
  return page.evaluate(async ({ endpoint, options }) => {
    const { authenticatedFetch } = await import("/src/services/authenticatedApi.js");
    const response = await authenticatedFetch(endpoint, options);
    return { status: response.status, body: response.headers.get("content-type")?.includes("application/json") ? await response.json() : { sizeBytes: (await response.arrayBuffer()).byteLength } };
  }, { endpoint, options });
}
async function openReport(page, role, reportId) {
  await page.goto(`/${role}/planting-reports?report=${encodeURIComponent(reportId)}`);
  await expect(page.locator(".pr-report-drawer")).toBeVisible({ timeout: 15000 });
}
async function captureOfficialPhoto(page, minimumTime) {
  await page.getByRole("button", { name: "Take Photo", exact: true }).click();
  await page.getByRole("button", { name: /Continue to Camera/ }).click();
  const video = page.locator("video.secure-camera-preview");
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate(node => node.videoWidth > 0 && node.videoHeight > 0)).toBe(true);
  await expect.poll(() => video.evaluate((node, minimum) => node.currentTime >= minimum, minimumTime)).toBe(true);
  await page.getByRole("button", { name: "Capture", exact: true }).click();
  const verification = page.waitForResponse(response => response.url().endsWith("/verify") && response.url().includes("/evidence-capture-sessions/"));
  await page.getByRole("button", { name: /Verify & Use Photo/ }).click();
  const response = await verification; expect(response.status(), await response.text()).toBe(200);
  await expect(page.getByText("Backend-verified camera capture", { exact: true })).toBeVisible();
}
test("real Staff draft-free official report, private attendance, Admin return, correction and verification preserve balances/history", async ({ browser }) => {
  const staffContext = await browser.newContext({ permissions: ["camera", "geolocation"], geolocation: { latitude: 12.662301, longitude: 123.932983, accuracy: 5 } }), staff = await staffContext.newPage();
  const data = await login(staff, "staff");
  await expect(staff.getByText("Login Successful", { exact: true })).toBeVisible();
  await expect(staff.locator(".menro-toast")).toContainText("Welcome back! You have successfully signed in.");
  await staff.reload(); await expect(staff.getByText("Login Successful", { exact: true })).toHaveCount(0);
  await staff.goto("/staff/planting-reports"); await staff.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  await staff.getByRole("combobox", { name: "Seedling Release Record *" }).selectOption(data.requestId);
  await expect(staff.getByLabel("Requester Full Name", { exact: true })).toHaveValue("Disposable requester");
  await staff.getByLabel("Final Leftover Seedlings (Not Planted)").fill("2");
  await captureOfficialPhoto(staff, .2);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQkAAAAASUVORK5CYII=", "base64");
  await staff.getByLabel("Attendance Photo/File (Optional)").setInputFiles({ name: "fixture-attendance.png", mimeType: "image/png", buffer: png });
  await expect(staff.getByText("fixture-attendance.png", { exact: true })).toBeVisible();
  const attendanceResponse = staff.waitForResponse(response => response.request().method() === "PUT" && /\/api\/planting-reports\/official\/[^/]+\/attendance$/.test(new URL(response.url()).pathname));
  const firstResponse = staff.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/planting-reports/official");
  await staff.getByRole("button", { name: "Submit for Admin Verification" }).click();
  const first = await firstResponse; expect(first.status(), await first.text()).toBe(201); const firstBody = await first.json(), originalId = firstBody.data.officialSubmissionIds[0];
  const originalPayload = first.request().postDataJSON();
  expect(firstBody.data.acceptedQuantity).toBe(0); expect(firstBody.data.remainingAvailableQuantity).toBe(2);
  const attachment = await attendanceResponse; expect(attachment.status(), await attachment.text()).toBe(200);
  await expect(staff.getByRole("dialog", { name: "Submit Official Planting Report" })).toHaveCount(0, { timeout: 15000 });
  const adminContext = await browser.newContext(), admin = await adminContext.newPage(); await login(admin, "admin");
  await openReport(admin, "admin", data.reportId);
  await expect(admin.getByText("Leftover Seedlings (Not Planted)", { exact: true })).toBeVisible();
  await expect(admin.getByRole("button", { name: "Download Private Attendance" })).toBeVisible();
  const privateFile = await admin.evaluate(async id => { const { authenticatedFetch } = await import("/src/services/authenticatedApi.js"); const response = await authenticatedFetch(`/planting-reports/official/${id}/attendance`); return { status: response.status, type: response.headers.get("content-type"), bytes: Array.from(new Uint8Array(await response.arrayBuffer())) }; }, originalId);
  expect(privateFile.status).toBe(200); expect(privateFile.type).toBe("image/png"); expect(Buffer.from(privateFile.bytes).equals(png)).toBe(true);
  // Admin returns (not rejects) the Staff report so the original Staff submitter can correct it.
  await admin.locator(".pr-submission-item").filter({ hasText: originalId }).getByRole("button", { name: "Return for Correction", exact: true }).click();
  const returnDialog = admin.getByRole("dialog", { name: "Return for Correction", exact: true });
  await returnDialog.locator("#pr-decision-reason").fill("Correct the field count and leftover balance.");
  const returned = admin.waitForResponse(response => response.url().endsWith(`/${originalId}/return`)); await returnDialog.getByRole("button", { name: "Return for Correction", exact: true }).click();
  expect((await returned).status()).toBe(200);
  await openReport(staff, "staff", data.reportId); await staff.getByRole("button", { name: "Correct Official Submission" }).click();
  await staff.getByLabel("Quantity Planted *").fill("7"); await staff.getByLabel("Leftover Seedlings (Not Planted) *").fill("3");
  await captureOfficialPhoto(staff, 1.2);
  await staff.getByLabel("Attendance Photo/File (Optional)").setInputFiles({ name: "correction-attendance.png", mimeType: "image/png", buffer: png });
  await expect(staff.getByText("correction-attendance.png", { exact: true })).toBeVisible();
  const correctionResponse = staff.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/planting-reports/official");
  await staff.getByRole("button", { name: "Submit for Admin Verification" }).click(); const correctedResponse = await correctionResponse;
  expect(correctedResponse.status(), await correctedResponse.text()).toBe(201); const corrected = await correctedResponse.json(), correctedId = corrected.data.officialSubmissionIds[0];
  expect(corrected.data.submissions.find(row => row.id === originalId).staffReviewStatus).toBe("Rejected"); expect(corrected.data.submissions.find(row => row.id === correctedId).revision).toBe(1);
  await expect(staff.getByRole("dialog", { name: "Correct Official Planting Report" })).toHaveCount(0, { timeout: 15000 });
  await openReport(admin, "admin", data.reportId);
  await admin.locator(".pr-submission-item").filter({ hasText: correctedId }).getByRole("button", { name: "Approve", exact: true }).click();
  const approvalResponse = admin.waitForResponse(response => response.url().endsWith(`/${correctedId}/approve`)); await admin.getByRole("dialog", { name: "Approve Planting Report?", exact: true }).getByRole("button", { name: "Approve Report", exact: true }).click();
  const approval = await approvalResponse; expect(approval.status(), await approval.text()).toBe(200); const approved = (await approval.json()).data;
  expect(approved.reportingProgress).toBe("Completed"); expect(approved.acceptedQuantity).toBe(7); expect(approved.acceptedLeftoverQuantity).toBe(3); expect(approved.remainingAvailableQuantity).toBe(0);
  for (const index of [0, 1]) {
    const photo = await api(admin, `/evidence/planting-reports/${data.reportId}/photos/${index}`);
    expect(photo.status, JSON.stringify(photo.body)).toBe(200); expect(photo.body.sizeBytes).toBeGreaterThan(0);
  }
  for (const id of [originalId, correctedId]) expect((await api(admin, `/planting-reports/official/${id}/attendance`)).status).toBe(200);
  const cohorts = await api(admin, "/verified-planting-cohorts"); expect(cohorts.status).toBe(200);
  const cohort = cohorts.body.data.find(row => row.source.plantingReportId === data.reportId); expect(cohort.verifiedPlantedQuantity).toBe(7); expect(cohort.source.species[0].verifiedPlantedQuantity).toBe(7);
  const retry = await api(staff, "/planting-reports/official", { method: "POST", body: JSON.stringify(originalPayload) }); expect(retry.status).toBe(201); expect(retry.body.data.submissions).toHaveLength(2);
  const stale = await api(staff, "/planting-reports/official", { method: "POST", body: JSON.stringify({ ...originalPayload, clientSubmissionId: crypto.randomUUID(), expectedVersion: 0 }) }); expect(stale.status).toBe(409);
  await openReport(staff, "staff", data.reportId); await expect(staff.getByRole("button", { name: "Correct Official Submission" })).toHaveCount(0);
  await expect(staff.locator('a[href*="firebasestorage.googleapis.com"]')).toHaveCount(0);
  await adminContext.close(); await staffContext.close();
});
test("real Participant, non-owner Staff and unauthenticated attendance access fail closed", async ({ browser }) => {
  const data = await fixture();
  const staffContext = await browser.newContext(), owner = await staffContext.newPage(); await login(owner, "staff");
  const report = await api(owner, `/planting-reports/${data.reportId}`), id = report.body.data.submissions[0].id;
  for (const [role, expected] of [["participant", 403], ["otherStaff", 404]]) {
    const context = await browser.newContext(), page = await context.newPage(); await login(page, role);
    const denied = await api(page, `/planting-reports/official/${id}/attendance`); expect(denied.status).toBe(expected); expect(JSON.stringify(denied.body)).not.toMatch(/objectName|privateEvidence|planting-attendance\/v1/);
    const photo = await api(page, `/evidence/planting-reports/${data.reportId}/photos/0`);
    expect(photo.status).toBe(403); expect(JSON.stringify(photo.body)).not.toMatch(/objectName|privateEvidence|uploadIntentId|evidence\/v1/);
    await context.close();
  }
  const denied = await owner.request.get(`http://127.0.0.1:5185/api/planting-reports/official/${id}/attendance`); expect(denied.status()).toBe(401);
  expect((await owner.request.get(`http://127.0.0.1:5185/api/evidence/planting-reports/${data.reportId}/photos/0`)).status()).toBe(401);
  await staffContext.close();
});
