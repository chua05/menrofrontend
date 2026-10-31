import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const backendPackage = process.env.MENRO_BACKEND_ROOT
  ? pathToFileURL(path.join(process.env.MENRO_BACKEND_ROOT, "package.json"))
  : new URL("../../../menrobackend/package.json", import.meta.url);
const backendRequire = createRequire(backendPackage);
const { PDFDocument } = backendRequire("pdf-lib");
const sharp = backendRequire("sharp");
const yazl = backendRequire("yazl");

const EMAIL = "request-letter.browser.participant@example.test";
const PASSWORD = "Request-Letter-Browser!2026";
const FRONTEND = process.env.MENRO_ACCEPTANCE_FRONTEND || "http://127.0.0.1:5173";
if (!/^http:\/\/(?:127\.0\.0\.1|localhost):517[34]$/.test(FRONTEND)) {
  throw new Error("Seedling Request browser acceptance requires an approved loopback frontend endpoint.");
}
const ACCEPTANCE_API = process.env.MENRO_ACCEPTANCE_API_URL || "http://127.0.0.1:5000/api";
if (!/^http:\/\/(?:127\.0\.0\.1|localhost):500[01]\/api$/.test(ACCEPTANCE_API)) {
  throw new Error("Seedling Request browser acceptance requires an approved loopback API endpoint.");
}
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["tablet", { width: 1024, height: 768 }],
  ["android", { width: 390, height: 844 }],
  ["iphone", { width: 375, height: 812 }],
];

async function loginAs(page, email = EMAIL, destination = "/participant/request-seedlings") {
  await page.goto(`${FRONTEND}/login`);
  await page.getByLabel("Email Address").fill(email);
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator(".login-primary-btn").click();
  await expect(page).toHaveURL(/\/(participant|staff|admin)\//);
  await page.goto(`${FRONTEND}${destination}`);
}

async function login(page) {
  await loginAs(page);
  await expect(page.getByText("Requester Information")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Full Name *")).toHaveValue("Browser Participant");
  await expect(page.getByLabel("Contact Number *")).toHaveValue("09123456789");
  await page.waitForTimeout(750);
}

async function expectValidation(page, message) {
  const invalid = page.locator(".sr-invalid-field").first();
  await expect(page.locator(".sr-validation-summary")).toHaveCount(0);
  await expect(invalid).toBeVisible();
  if (message) await expect(invalid).toContainText(message);
  await expect.poll(() => invalid.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await expect.poll(async () => {
    const box = await invalid.boundingBox();
    return box && box.y >= 0 && box.y < page.viewportSize().height;
  }).toBe(true);
}

async function fillStep1(page, sector, requestingAs = "") {
  await page.getByLabel("Sector *").selectOption({ label: sector });
  await expect(page.getByLabel("Sector *")).toHaveValue(sector);
  if (requestingAs) await page.getByRole("radio", { name: requestingAs === "group"
    ? /School \/ Organization Representative|Group \/ Organization/
    : /Individual \/ Student|Individual/ }).check();
  await page.getByLabel("Province *").selectOption("Sorsogon");
  await expect(page.getByLabel("Province *")).toHaveValue("Sorsogon");
  await expect(page.getByLabel("Municipality / City *").locator('option[value="Bulan"]')).toBeAttached();
  await page.getByLabel("Municipality / City *").selectOption("Bulan");
  await expect(page.getByLabel("Municipality / City *")).toHaveValue("Bulan");
  await page.getByLabel("Barangay *").selectOption("Bical");
  await page.getByLabel("Street / Purok / Sitio *").fill("   ");
  await page.getByRole("button", { name: /Next/ }).click();
  await expectValidation(page, "Please enter your street");
  await expect(page.getByLabel("Sector *")).toHaveValue(sector);
  await page.getByLabel("Street / Purok / Sitio *").fill("Purok 1");
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByRole("heading", { name: "Request Details", exact: true })).toBeVisible();
}

async function fillStep2(page, { group = false, frozen = false, preferredReleaseDate = "" } = {}) {
  await page.getByRole("button", { name: /Next/ }).click();
  await expectValidation(page, "Select a purpose");
  await page.getByLabel("Purpose of Request *").selectOption(
    group ? "Tree Planting Activity" : "Backyard / Home Planting",
  );
  const treeRow = page.locator(".sr-tree-row").first();
  await treeRow.locator("select").selectOption("request-letter-browser-inventory");
  await treeRow.locator('input[type="number"]').fill("2");
  await page.getByLabel("Preferred Release Date *")
    .fill(preferredReleaseDate || (frozen ? "2026-10-27" : "2026-11-10"));
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByRole("heading", { name: "Planting Information", exact: true })).toBeVisible();
}

test("Resident / Individual renders only the individual purposes", async ({ page }) => {
  await login(page);
  await fillStep1(page, "Resident / Individual");
  expect(await page.getByLabel("Purpose of Request *").locator("option").allTextContents()).toEqual([
    "Select purpose",
    "Backyard / Home Planting",
    "Fruit-Bearing Tree Planting",
    "Farm / Agricultural Planting",
    "Land Rehabilitation / Reforestation",
    "Replacement Planting",
    "Environmental Conservation",
    "Other (Please Specify)",
  ]);
  await expect(page.getByText("Individual Planting Schedule", { exact: true })).toHaveCount(0);
});

test("School / Student switches purpose and schedule fields by Requesting As", async ({ page }) => {
  await login(page);
  await fillStep1(page, "School / Student", "individual");
  expect(await page.getByLabel("Purpose of Request *").locator("option").allTextContents()).toEqual([
    "Select purpose", "Backyard / Home Planting", "Fruit-Bearing Tree Planting",
    "Farm / Agricultural Planting", "Land Rehabilitation / Reforestation",
    "Replacement Planting", "Environmental Conservation", "Other (Please Specify)",
  ]);
  await page.getByLabel("Purpose of Request *").selectOption("Backyard / Home Planting");
  const individualTreeRow = page.locator(".sr-tree-row").first();
  await individualTreeRow.locator("select").selectOption("request-letter-browser-inventory");
  await individualTreeRow.locator('input[type="number"]').fill("2");
  await page.getByLabel("Preferred Release Date *").fill("2026-11-10");
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByText("Individual Planting Schedule", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Back/ }).click();
  await page.getByRole("button", { name: /Back/ }).click();
  await page.getByRole("radio", { name: "School / Organization Representative", exact: true }).check();
  await page.getByRole("button", { name: /Next/ }).click();
  const purposes = await page.getByLabel("Purpose of Request *").locator("option").allTextContents();
  expect(purposes).toContain("School Activity");
  expect(purposes).not.toContain("Backyard / Home Planting");
  await expect(page.getByLabel("Purpose of Request *")).toHaveValue("");
  await fillStep2(page, { group: true });
  await expect(page.getByText("Organization Planting Event", { exact: true })).toBeVisible();
});

async function fillStep3(page, { group, frozen = false }) {
  await page.getByRole("button", { name: /Next/ }).click();
  await expectValidation(page);
  const barangays = page.getByLabel("Barangay *");
  await barangays.last().selectOption("ZoneVIIIPoblacion");
  await page.locator("select").filter({
    has: page.locator('option[value="request-letter-browser-site"]'),
  }).selectOption("request-letter-browser-site");
  await page.getByLabel("Planting Area *").selectOption("1 hectare");
  await page.getByLabel("Pick-up").check();
  if (group) await page.getByLabel("Event Name *").fill("Browser Acceptance Planting");
  await page.getByLabel(group ? "Proposed Event Date *" : "Planned Planting Date *")
    .fill(frozen ? "2026-10-27" : "2026-11-12");
  await page.getByLabel(group ? "Start Time *" : "Planned Start Time *").fill(frozen ? "04:34" : "09:00");
  if (group) await page.getByLabel("End Time *").fill(frozen ? "06:00" : "11:00");
  await page.getByLabel(group ? "Expected Participants *" : "Planned Number of Planters *")
    .fill(group ? "30" : "1");
  await page.getByLabel("Who will be responsible for caring for the planted seedlings? *").fill("Browser Test Organization");
  await page.getByLabel("How often do you plan to check the planted seedlings? *").selectOption("Weekly");
  await page.getByLabel("How will you care for and maintain the seedlings after planting? *")
    .fill("Water, protect, and monitor the seedlings every week.");
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByRole("heading", { name: "Review Your Request", exact: true })).toBeVisible();
}

async function makeFiles() {
  const pdf = await PDFDocument.create(); pdf.addPage([100, 100]);
  const zip = new yazl.ZipFile(), chunks = [];
  const docx = new Promise((resolve, reject) => {
    zip.outputStream.on("data", chunk => chunks.push(chunk));
    zip.outputStream.once("error", reject); zip.outputStream.once("end", () => resolve(Buffer.concat(chunks)));
  });
  zip.addBuffer(Buffer.from('<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'), "[Content_Types].xml");
  zip.addBuffer(Buffer.from('<Relationships><Relationship Id="rId1" Target="word/document.xml"/></Relationships>'), "_rels/.rels");
  zip.addBuffer(Buffer.from('<w:document xmlns:w="x"><w:body><w:p/></w:body></w:document>'), "word/document.xml");
  zip.end();
  return [
    { name: "letter.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) },
    { name: "letter.jpg", mimeType: "image/jpeg", buffer: await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).jpeg().toBuffer() },
    { name: "letter.png", mimeType: "image/png", buffer: await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer() },
    { name: "letter.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: await docx },
  ];
}

async function completeStep4(page, file) {
  await page.getByRole("button", { name: "Submit Request" }).click();
  await expectValidation(page);
  if (file) await page.locator('input[type="file"][accept*=".docx"]').setInputFiles(file);
  await page.getByLabel("Identification Type *").selectOption("national_id");
  await page.getByLabel("ID Number *").fill(`TEST-${Date.now()}`);
  await page.getByLabel(/I confirm that the information/).check();
  const saved = page.waitForResponse((response) =>
    response.url().includes("/api/seedling-requests") &&
    ["POST", "PATCH"].includes(response.request().method()));
  await page.getByRole("button", { name: "Submit Request" }).click();
  const response = await saved;
  const payload = await response.json();
  expect(response.status(), JSON.stringify(payload)).toBeLessThan(300);
  await expect(page).toHaveURL(/\/participant\/my-requests/);
  return payload.data;
}

async function openStaffRequest(page, role, requestNumber) {
  await loginAs(page, `request-letter.browser.${role}@example.test`, `/${role}/requests`);
  await page.getByLabel(`View details for ${requestNumber}`).click();
  await expect(page.getByRole("button", { name: "Download", exact: true })).toBeVisible();
}

async function downloadBytes(page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const download = await pending;
  return readFile(await download.path());
}

async function returnFromStaff(page, requestNumber, reason) {
  await openStaffRequest(page, "staff", requestNumber);
  await page.getByRole("button", { name: "Return Request" }).click();
  const dialog = page.getByRole("dialog", { name: "Return Request" });
  await dialog.getByPlaceholder("Enter the information that needs to be corrected...").fill(reason);
  await dialog.getByRole("button", { name: "Return Request" }).click();
  await expect(page.getByText(/returned for revision/i)).toBeVisible();
}

async function resubmitReturned(page, requestNumber, replacement = null) {
  await page.goto(`${FRONTEND}/participant/my-requests`);
  await page.getByLabel(`View details of ${requestNumber}`).click();
  await page.getByRole("button", { name: "Edit Request" }).click();
  await expect(page.getByText("Requester Information")).toBeVisible();
  for (const heading of ["Request Details", "Planting Information", "Review Your Request"]) {
    await page.getByRole("button", { name: /Next/ }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  if (replacement) await page.locator('input[type="file"][accept*=".docx"]').setInputFiles(replacement);
  await page.getByLabel(/I confirm that the information/).check();
  const saved = page.waitForResponse((response) => response.url().includes("/resubmit") && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Submit Request" }).click();
  const response = await saved;
  await expect(page).toHaveURL(/\/participant\/my-requests/);
  return response;
}

test("Individual Steps 1-4 validate, preserve values, focus errors, and submit", async ({ page }) => {
  await login(page); await fillStep1(page, "Resident / Individual"); await fillStep2(page);
  await fillStep3(page, { group: false }); await completeStep4(page, null);
});

for (const fileIndex of [0, 1, 2, 3]) test(`Organization submits actual multipart format ${fileIndex + 1}`, async ({ page }) => {
  const file = (await makeFiles())[fileIndex];
  await login(page); await fillStep1(page, "Civic Organization / NGO"); await fillStep2(page, { group: true });
  await fillStep3(page, { group: true }); await completeStep4(page, file);
  await page.getByTitle("View request details").first().click();
  await expect(page.getByRole("button", { name: "Download Request Letter" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Request Letter" }).click();
  expect(await readFile(await (await download).path())).toEqual(file.buffer);
});

test("frozen October 26/27 group schedule advances to Step 4", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-26T15:49:00.000Z"));
  await login(page); await fillStep1(page, "Civic Organization / NGO"); await fillStep2(page, { group: true, frozen: true });
  await fillStep3(page, { group: true, frozen: true });
  await expect(page.locator(".sr-validation-summary")).toHaveCount(0);
});

test("same-day release and event schedule advances to Step 4 before planting starts", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-28T08:00:00.000Z"));
  await login(page);
  await fillStep1(page, "Civic Organization / NGO");
  await fillStep2(page, { group: true, preferredReleaseDate: "2026-10-28" });

  const barangays = page.getByLabel("Barangay *");
  await barangays.last().selectOption("ZoneVIIIPoblacion");
  await page.locator("select").filter({
    has: page.locator('option[value="request-letter-browser-site"]'),
  }).selectOption("request-letter-browser-site");
  await page.getByLabel("Planting Area *").selectOption("Less than 1 hectare");
  await page.getByLabel("Exact Planting Area (hectares) *").fill("0.50");
  await page.getByLabel("Pick-up").check();
  await page.getByLabel("Event Name *").fill("Test Tree Planting");
  await page.getByLabel("Proposed Event Date *").fill("2026-10-28");
  await page.getByLabel("Start Time *").fill("17:00");
  await page.getByLabel("End Time *").fill("18:00");
  await page.getByLabel("Expected Participants *").fill("40");
  await page.getByLabel("Who will be responsible for caring for the planted seedlings? *")
    .fill("Community Care Team");
  await page.getByLabel("How often do you plan to check the planted seedlings? *")
    .selectOption("Weekly");
  await page.getByLabel("How will you care for and maintain the seedlings after planting? *")
    .fill("Water, protect, and monitor the seedlings every week.");

  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByRole("heading", { name: "Review Your Request", exact: true })).toBeVisible();
  await expect(page.locator(".sr-validation-summary")).toHaveCount(0);
});

test("expired same-day start shows focused mobile validation without clearing values", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-10-28T09:01:00.000Z"));
  await login(page);
  await fillStep1(page, "Civic Organization / NGO");
  await fillStep2(page, { preferredReleaseDate: "2026-10-28" });

  const barangays = page.getByLabel("Barangay *");
  await barangays.last().selectOption("ZoneVIIIPoblacion");
  await page.locator("select").filter({
    has: page.locator('option[value="request-letter-browser-site"]'),
  }).selectOption("request-letter-browser-site");
  await page.getByLabel("Planting Area *").selectOption("Less than 1 hectare");
  await page.getByLabel("Exact Planting Area (hectares) *").fill("0.50");
  await page.getByLabel("Pick-up").check();
  await page.getByLabel("Event Name *").fill("Test Tree Planting");
  await page.getByLabel("Proposed Event Date *").fill("2026-10-28");
  await page.getByLabel("Start Time *").fill("17:00");
  await page.getByLabel("End Time *").fill("18:00");
  await page.getByLabel("Expected Participants *").fill("40");
  await page.getByLabel("Who will be responsible for caring for the planted seedlings? *")
    .fill("Community Care Team");
  await page.getByLabel("How often do you plan to check the planted seedlings? *")
    .selectOption("Weekly");
  await page.getByLabel("How will you care for and maintain the seedlings after planting? *")
    .fill("Water, protect, and monitor the seedlings every week.");

  await page.getByRole("button", { name: /Next/ }).click();
  await expectValidation(page, "The event start time must be in the future.");
  await expect(page.getByLabel("Start Time *")).toHaveValue("17:00");
  await expect(page.getByLabel("End Time *")).toHaveValue("18:00");
  await expect(page.getByLabel("Event Name *")).toHaveValue("Test Tree Planting");
  await expect(page.getByRole("heading", { name: "Planting Information", exact: true })).toBeVisible();
});

for (const [name, viewport] of viewports) test(`${name} viewport has stable accessible wizard layout`, async ({ page }) => {
  await page.setViewportSize(viewport); await login(page);
  await page.getByRole("button", { name: /Next/ }).click(); await expectValidation(page);
  const dimensions = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
  const next = page.getByRole("button", { name: /Next/ });
  await next.scrollIntoViewIfNeeded();
  await expect(next).toBeInViewport();
});

test("returned organization request retains then replaces its immutable private letter", async ({ browser }) => {
  const [original, , replacement] = await makeFiles();
  const participant = await browser.newPage();
  await login(participant); await fillStep1(participant, "Civic Organization / NGO"); await fillStep2(participant);
  await fillStep3(participant, { group: true });
  const created = await completeStep4(participant, original);
  expect(created.id).toBeTruthy();
  expect(created.requestNumber).toBeTruthy();

  const staff = await browser.newPage();
  await returnFromStaff(staff, created.requestNumber, "Correct the synthetic organization details.");
  const retained = await resubmitReturned(participant, created.requestNumber);
  expect(retained.status()).toBe(200);

  await staff.close();
  const secondStaff = await browser.newPage();
  await returnFromStaff(secondStaff, created.requestNumber, "Attach the revised synthetic letter.");
  const replaced = await resubmitReturned(participant, created.requestNumber, replacement);
  expect(replaced.status()).toBe(200);

  for (const role of ["staff", "admin"]) {
    const reviewer = await browser.newPage();
    await openStaffRequest(reviewer, role, created.requestNumber);
    expect(await downloadBytes(reviewer)).toEqual(replacement.buffer);
    await expect(reviewer.locator("body")).not.toContainText("firebasestorage.app");
    await expect(reviewer.locator("body")).not.toContainText("request-letters/v1");
    await reviewer.close();
  }

  const historical = await browser.newPage();
  await loginAs(historical, "request-letter.browser.staff@example.test",
    "/staff/requests?request=request-letter-browser-historical");
  await expect(historical.getByRole("button", { name: "Download", exact: true })).toHaveCount(0);
  await historical.close();

  const other = await browser.newPage();
  await loginAs(other, "request-letter.browser.other@example.test", "/participant/my-requests");
  const forbidden = await other.evaluate(async ({ id, apiUrl }) => {
    const { auth } = await import("/src/firebase/config.js");
    const token = await auth.currentUser.getIdToken();
    return fetch(`${apiUrl}/seedling-requests/${id}/request-letter`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => response.status);
  }, { id: created.id, apiUrl: ACCEPTANCE_API });
  expect(forbidden).toBe(403);
  await other.close(); await secondStaff.close(); await participant.close();
});

test("interrupted organization upload preserves form state and retries idempotently", async ({ page }) => {
  const file = (await makeFiles())[3];
  await login(page); await fillStep1(page, "Civic Organization / NGO"); await fillStep2(page);
  await fillStep3(page, { group: true });
  await page.getByRole("button", { name: "Submit Request" }).click();
  await expectValidation(page);
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles(file);
  await page.getByLabel("Identification Type *").selectOption("national_id");
  await page.getByLabel("ID Number *").fill("TEST-INTERRUPTED-UPLOAD");
  await page.getByLabel(/I confirm that the information/).check();
  await page.route("**/api/seedling-requests", (route) => route.abort("connectionfailed"));
  await page.getByRole("button", { name: "Submit Request" }).click();
  await expect(page).toHaveURL(/\/participant\/request-seedlings/);
  await expect(page.getByText(/unable|connection|try again/i).first()).toBeVisible();
  await expect(page.getByText(file.name)).toBeVisible();
  await expect(page.getByText(/stored successfully/i)).toHaveCount(0);
  await page.unroute("**/api/seedling-requests");
  const response = page.waitForResponse((candidate) => candidate.url().endsWith("/api/seedling-requests") && candidate.status() === 201);
  await page.getByRole("button", { name: "Submit Request" }).click();
  await response;
  await expect(page).toHaveURL(/\/participant\/my-requests/);
});
