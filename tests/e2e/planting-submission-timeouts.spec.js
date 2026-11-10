import process from "node:process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Requires backend fixtures: `node tests/integration/seedPlantingViewReportBrowserAcceptance.js`
// (menrosystem backend) on a fresh seed, and PLANTING_PHOTO: a JPEG whose EXIF GPS
// lies at "View Report Form Site" (12.672, 123.876) and was taken on 2026-10-01.
// Reproduces submissions whose response never arrives (or whose connection drops
// after MENRO saved them) and checks the forms recover without duplicates.
const FRONTEND = "http://127.0.0.1:5173";
const PASSWORD = "Planting-View-Browser!2026";
const PHOTO = process.env.PLANTING_PHOTO || "";
const PHOTO_2 = process.env.PLANTING_PHOTO_2 || "";
const STAFF_SITE = "View Report Staff Site";
const AMBIGUOUS = "MENRO did not confirm the submission in time. It may already be saved.";

test.describe.configure({ mode: "serial" });

function watchErrors(page) {
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  return problems;
}

async function login(page, role, path) {
  await page.goto(`${FRONTEND}/login`);
  await page.getByLabel("Email Address").fill(`planting-view.${role}@example.test`);
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator(".login-primary-btn").click();
  await expect(page).toHaveURL(new RegExp(`/${role}/`));
  if (role === "participant") await expect(page.getByText(/^Welcome, /)).toBeVisible({ timeout: 20_000 });
  await page.goto(`${FRONTEND}${path}`);
}

async function selectByText(select, text) {
  await expect.poll(() => select.locator("option").evaluateAll((options, wanted) =>
    options.some((option) => option.textContent.includes(wanted) && !option.disabled), text), { timeout: 20_000 }).toBe(true);
  const value = await select.locator("option").evaluateAll((options, wanted) =>
    options.find((option) => option.textContent.includes(wanted) && !option.disabled).value, text);
  await select.selectOption(value);
}

const isPost = (request, pathname) => request.method() === "POST" && new URL(request.url()).pathname === pathname;

async function openParticipantForm(page, photoPath) {
  const openForm = page.getByRole("button", { name: "Submit Planting Report", exact: true });
  await expect(openForm).toBeEnabled({ timeout: 20_000 });
  await openForm.click();
  const form = page.locator("form").filter({ has: page.locator("#planting-distributionId") });
  await expect(form).toBeVisible({ timeout: 20_000 });
  await selectByText(form.locator("#planting-barangay"), "Bical");
  await selectByText(form.locator("#planting-siteId"), "View Report Form Site");
  await selectByText(form.locator("#planting-eventId"), "View Report form planting");
  await selectByText(form.locator("#planting-distributionId"), "Narra, Molave");
  await expect(form.locator(".pr-final-report-table .pr-final-planted")).toHaveText(["8", "4"]);
  if (!(await form.locator("#planting-submittedByName").inputValue())) await form.locator("#planting-submittedByName").fill("Planting View Participant");
  if (!(await form.locator("#planting-submittedByContactNumber").inputValue())) await form.locator("#planting-submittedByContactNumber").fill("09171234567");
  const sector = form.locator("#planting-submittedBySector");
  if (!(await sector.inputValue())) await sector.selectOption({ index: 1 });
  await form.locator("#planting-remarks").fill("Planted along the river bank");
  await form.locator("#planting-photos").setInputFiles({ name: "field-photo.jpg", mimeType: "image/jpeg", buffer: readFileSync(photoPath) });
  await expect(form.getByText(/Verified/).first()).toBeVisible({ timeout: 30_000 });
  return form;
}

// Browser storage may hold only identifiers and the typed report fields needed
// to check or replay a submission: never photos, previews or evidence data.
const PARTICIPANT_PENDING_KEYS = ["kind", "savedAt", "eventId", "knownSubmissionIds", "contributorId"];
const STAFF_PENDING_KEYS = ["kind", "savedAt", "body", "needsEvidence", "attendancePending", "correction"];
const STAFF_BODY_KEYS = ["requestId", "items", "confirmationBasis", "remarks", "expectedVersion", "clientSubmissionId", "correctionOf"];
async function expectNoEvidenceInStorage(target) {
  const stored = await target.evaluate(() => Object.keys(sessionStorage).concat(Object.keys(localStorage))
    .filter((key) => key.startsWith("menro.pendingPlantingSubmission.")).map((key) => sessionStorage.getItem(key) ?? localStorage.getItem(key)));
  for (const raw of stored) {
    const value = JSON.parse(raw);
    const allowed = value.kind === "staff" ? STAFF_PENDING_KEYS : PARTICIPANT_PENDING_KEYS;
    expect(Object.keys(value).filter((key) => !allowed.includes(key))).toEqual([]);
    if (value.body) {
      expect(Object.keys(value.body).filter((key) => !STAFF_BODY_KEYS.includes(key))).toEqual([]);
      for (const item of value.body.items) expect(Object.keys(item).filter((key) => !["inventoryId", "quantityPlanted", "leftoverQuantity", "leftoverReason"].includes(key))).toEqual([]);
    }
    expect(raw).not.toMatch(/data:|blob:|base64|\.jpe?g|photo|imageHash|evidenceManifest|latitude|longitude|exif/i);
    expect(raw.length).toBeLessThan(4000);
  }
  return stored.length;
}

const pendingKeys = (target) => target.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("menro.pendingPlantingSubmission.")).length);

test("participant: an unconfirmed submission survives closing, reopening and reloading, and is never duplicated", async ({ page }) => {
  test.skip(!PHOTO || !PHOTO_2, "PLANTING_PHOTO and PLANTING_PHOTO_2 are generated by the browser run script");
  test.setTimeout(300_000);
  const problems = watchErrors(page);
  const posts = [];
  const countPosts = (target) => target.on("request", (request) => { if (isPost(request, "/api/planting-reports")) posts.push(request.url()); });
  countPosts(page);

  await login(page, "participant", "/participant/my-planting-reports");
  const form = await openParticipantForm(page, PHOTO);
  const submit = form.locator('button[type="submit"]');
  const alert = page.locator(".pr-submit-alert");

  // 1. The connection drops before MENRO receives the report.
  await page.route("**/api/planting-reports", (route) => route.request().method() === "POST" ? route.abort("connectionreset") : route.fallback(), { times: 1 });
  await submit.click();
  await expect(alert).toContainText(AMBIGUOUS, { timeout: 20_000 });
  await expect(submit).toHaveText(/Check Submission/);
  await expect(submit).toBeEnabled();
  await expect(form.locator("#planting-remarks")).toBeDisabled(); // locked until reconciled
  await expect(page.getByRole("status").filter({ hasText: "Not yet confirmed by MENRO." })).toBeVisible();
  expect(posts).toHaveLength(1);

  // 2. Closing and reopening keeps the same locked submission and its evidence.
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(form).toBeHidden();
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  await expect(form).toBeVisible();
  await expect(submit).toHaveText(/Check Submission/);
  await expect(form.locator("#planting-remarks")).toHaveValue("Planted along the river bank");
  await expect(form.locator("#planting-remarks")).toBeDisabled();
  await expect(form.getByText(/Verified/).first()).toBeVisible();
  expect(await pendingKeys(page)).toBe(1);
  expect(await expectNoEvidenceInStorage(page)).toBe(1);

  // A second tab prepares the same report while the first is unresolved.
  const other = await page.context().newPage();
  countPosts(other);
  await other.goto(`${FRONTEND}/participant/my-planting-reports`);
  const otherForm = await openParticipantForm(other, PHOTO_2);

  // 3. Check Submission finds nothing saved, so it sends the same report again.
  //    MENRO saves it but the response never arrives: the 60 s submission
  //    timeout must end "Submitting..." on its own.
  let releaseHeld;
  const held = new Promise((resolve) => { releaseHeld = resolve; });
  await page.route("**/api/planting-reports", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    await held; // never answer the browser
    await route.abort().catch(() => {});
  }, { times: 1 });
  const started = Date.now();
  await submit.click();
  await expect(submit).toHaveText(/Submitting/);
  await expect(alert).toHaveCount(0); // the earlier message is cleared while checking
  await expect(alert).toContainText(AMBIGUOUS, { timeout: 90_000 });
  const waited = Date.now() - started;
  expect(waited).toBeGreaterThan(55_000);
  expect(waited).toBeLessThan(90_000);
  expect(posts).toHaveLength(2);
  releaseHeld();

  // 4. Close, then reload: the stored submission is checked against the list
  //    and reported as saved; nothing is resent.
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await expect(page.getByText("Your earlier planting report was saved and is awaiting MENRO Staff verification. Do not submit it again.").first()).toBeVisible({ timeout: 20_000 });
  expect(await pendingKeys(page)).toBe(0);
  expect(posts).toHaveLength(2);

  // 5. The second tab submits: MENRO refuses it, and the reason shown is the
  //    already-saved report, not a changed balance.
  await otherForm.locator('button[type="submit"]').click();
  await expect(other.getByText("Your planting report for this event is already saved and awaiting MENRO Staff verification. It was not submitted again.").first()).toBeVisible({ timeout: 20_000 });
  await expect(other.getByText(/balance/i)).toHaveCount(0);
  expect(posts).toHaveLength(3);
  await other.close();

  const row = page.locator("tr", { hasText: "View Report Form Site" });
  await expect(row).toHaveCount(1, { timeout: 20_000 });
  await row.getByRole("button", { name: /^View / }).click();
  const drawer = page.getByRole("dialog", { name: /Planting report/ });
  await expect(drawer.locator(".pr-submission-item")).toHaveCount(2, { timeout: 20_000 }); // Narra + Molave, saved once
  expect(problems).toEqual([]);
});

async function adminReturnsRemarks(page) {
  await login(page, "admin", "/admin/planting-reports");
  const row = page.locator("tr", { hasText: STAFF_SITE });
  await expect(row).toHaveCount(1, { timeout: 20_000 });
  await row.getByRole("button", { name: /^View / }).click();
  const drawer = page.getByRole("dialog", { name: /Planting report/ });
  await drawer.getByRole("button", { name: "Return for Correction", exact: true }).click();
  const modal = page.locator(".pr-decision-modal");
  await modal.locator("#pr-decision-reason").fill("Remarks need the attendees");
  await modal.locator('[data-field-path="remarks"] input[type="checkbox"]').check();
  await modal.locator('[data-field-path="remarks"] textarea').fill("Name who attended");
  await modal.getByRole("button", { name: "Return for Correction", exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 20_000 });
}

test("Admin returns the Staff report so Staff can resubmit it", async ({ page }) => {
  await adminReturnsRemarks(page);
});

test("Staff: a lost save survives closing, reopening and reloading, is replayed safely, and a failed refresh does not hide it", async ({ page }) => {
  test.setTimeout(120_000);
  const problems = watchErrors(page);
  const posts = [];
  page.on("request", (request) => { if (isPost(request, "/api/planting-reports/official")) posts.push(request.url()); });
  await login(page, "staff", "/staff/planting-reports");
  const row = page.locator("tr", { hasText: STAFF_SITE });
  await expect(row).toHaveCount(1, { timeout: 20_000 });
  await row.getByRole("button", { name: /^View / }).click();
  const drawer = page.getByRole("dialog", { name: /Planting report/ });
  await drawer.getByRole("button", { name: "Correct Official Submission" }).click();
  const form = page.locator(".pr-official-dialog");
  await expect(form.locator("#official-remarks")).toHaveValue("Planted with the requester", { timeout: 20_000 });
  await form.locator("#official-remarks").fill("Planted with the requester and Kagawad Reyes");

  // MENRO saves the correction, then the connection drops before the response.
  await page.route("**/api/planting-reports/official", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    await route.abort("connectionreset");
  }, { times: 1 });
  const submit = form.locator('button[type="submit"]');
  await submit.click();
  await expect(form.getByRole("alert")).toContainText(AMBIGUOUS, { timeout: 20_000 });
  await expect(submit).toHaveText("Check Submission");
  await expect(form.locator("#official-remarks")).toBeDisabled();
  await expect(form.getByRole("button", { name: "Refresh Releases" })).toHaveCount(0);

  // Closing, reopening (even as a new report) and reloading keep the pending
  // save: the form opens on the check panel instead of a fresh report.
  await form.getByRole("button", { name: "Close", exact: true }).click();
  await expect(form).toBeHidden();
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  const panel = page.locator(".pr-official-dialog");
  await expect(panel.getByRole("heading", { name: "Unconfirmed Official Planting Report" })).toBeVisible();
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await expect(page.locator("tr", { hasText: STAFF_SITE })).toHaveCount(1, { timeout: 20_000 });
  await page.getByRole("button", { name: "Submit Planting Report", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Unconfirmed Official Planting Report" })).toBeVisible({ timeout: 20_000 });
  await expect(panel).toContainText("may already be saved");
  expect(await pendingKeys(page)).toBe(1);
  expect(await expectNoEvidenceInStorage(page)).toBe(1);

  // The list refresh after the confirmed save fails: the save is still reported.
  await page.route("**/api/planting-reports", (route) => route.request().method() === "GET" ? route.abort("connectionreset") : route.fallback(), { times: 1 });
  await panel.getByRole("button", { name: "Check Submission" }).click();
  await expect(panel).toBeHidden({ timeout: 20_000 });
  expect(await pendingKeys(page)).toBe(0);
  await expect(page.getByText(/Corrected official planting report resubmitted to the MENRO Admin for approval\./).first()).toBeVisible();
  await expect(page.getByText(/latest lists could not be refreshed/).first()).toBeVisible({ timeout: 40_000 });
  await expect(page.locator("tr", { hasText: STAFF_SITE })).toHaveCount(1); // list kept, no error page
  expect(posts).toHaveLength(2); // original + idempotent replay with the same submission key

  // The replay returned the saved correction instead of creating another one.
  await page.reload();
  const refreshed = page.locator("tr", { hasText: STAFF_SITE });
  await expect(refreshed.locator(".pr-review-line")).toHaveText("Review Status: Pending Admin Approval", { timeout: 20_000 });
  await refreshed.getByRole("button", { name: /^View / }).click();
  await expect(page.getByRole("dialog", { name: /Planting report/ }).locator(".pr-submission-item")).toHaveCount(4, { timeout: 20_000 });
  expect(problems).toEqual([]);
});

test("Admin returns the corrected Staff report again", async ({ page }) => {
  await adminReturnsRemarks(page);
});

test("Staff: a replay that MENRO definitively rejects clears the pending save and reopens the usable form", async ({ page }) => {
  test.setTimeout(120_000);
  const problems = watchErrors(page);
  const posts = [];
  page.on("request", (request) => { if (isPost(request, "/api/planting-reports/official")) posts.push(request.url()); });
  await login(page, "staff", "/staff/planting-reports");
  const row = page.locator("tr", { hasText: STAFF_SITE });
  await expect(row.locator(".pr-review-line")).toHaveText("Review Status: Returned for Correction", { timeout: 20_000 });
  await row.getByRole("button", { name: /^View / }).click();
  await page.getByRole("dialog", { name: /Planting report/ }).getByRole("button", { name: "Correct Official Submission" }).click();
  const form = page.locator(".pr-official-dialog");
  await expect(form.locator("#official-remarks")).toHaveValue("Planted with the requester and Kagawad Reyes", { timeout: 20_000 });
  await form.locator("#official-remarks").fill("First attempt that never reached MENRO");

  // 1. The connection drops before MENRO receives the correction: nothing is saved.
  await page.route("**/api/planting-reports/official", (route) => route.request().method() === "POST" ? route.abort("connectionreset") : route.fallback(), { times: 1 });
  const submit = form.locator('button[type="submit"]');
  await submit.click();
  await expect(form.getByRole("alert")).toContainText(AMBIGUOUS, { timeout: 20_000 });
  await form.getByRole("button", { name: "Close", exact: true }).click();
  expect(await pendingKeys(page)).toBe(1);
  expect(await expectNoEvidenceInStorage(page)).toBe(1);

  // 2. Meanwhile the reportable balance moves on (simulated by making the
  //    stored attempt one version behind MENRO). The replay then gets a real
  //    definitive refusal from MENRO instead of an unknown outcome.
  await page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((entry) => entry.startsWith("menro.pendingPlantingSubmission.staff."));
    const value = JSON.parse(sessionStorage.getItem(key));
    value.body.expectedVersion -= 1;
    sessionStorage.setItem(key, JSON.stringify(value));
  });
  await page.reload();
  await expect(page.locator("tr", { hasText: STAFF_SITE })).toHaveCount(1, { timeout: 20_000 });
  await page.locator("tr", { hasText: STAFF_SITE }).getByRole("button", { name: /^View / }).click();
  await page.getByRole("dialog", { name: /Planting report/ }).getByRole("button", { name: "Correct Official Submission" }).click();
  const panel = page.locator(".pr-official-dialog");
  await expect(panel.getByRole("heading", { name: "Unconfirmed Official Planting Report" })).toBeVisible({ timeout: 20_000 });
  const replay = page.waitForResponse((response) => isPost(response.request(), "/api/planting-reports/official"));
  await panel.getByRole("button", { name: "Check Submission" }).click();
  expect((await replay).status()).toBe(409);

  // 3. The pending save is cleared, the reason is shown, and the original
  //    correction form is usable again.
  await expect(page.getByRole("heading", { name: "Correct Official Planting Report" })).toBeVisible({ timeout: 20_000 });
  await expect(form.getByRole("alert").first()).toHaveText("The earlier report was not saved. The reportable balance changed. Refresh before submitting.");
  expect(await pendingKeys(page)).toBe(0);
  await expect(form.locator(".pr-correction-banner")).toContainText("Only these fields can be changed");
  const remarks = form.locator("#official-remarks");
  await expect(remarks).toBeEnabled();
  await expect(remarks).not.toHaveAttribute("readonly");
  await expect(remarks).toHaveValue("Planted with the requester and Kagawad Reyes"); // the returned report's values, not the unsaved attempt
  await expect(form.locator("#official-leftover-0")).toHaveAttribute("readonly", ""); // only the returned field is editable
  await expect(form.getByRole("button", { name: "Refresh Releases" })).toBeVisible();
  await expect(submit).toHaveText("Submit for Admin Verification");
  await expect(submit).toBeEnabled();

  // 4. The correction is then submitted normally, exactly once.
  await remarks.fill("Planted with the requester, Kagawad Reyes and two volunteers");
  await submit.click();
  await expect(form).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText(/Corrected official planting report resubmitted to the MENRO Admin for approval\./).first()).toBeVisible();
  expect(posts).toHaveLength(3); // dropped attempt (never reached MENRO) + refused replay + the new submission
  expect(await pendingKeys(page)).toBe(0);

  await page.reload();
  const refreshed = page.locator("tr", { hasText: STAFF_SITE });
  await expect(refreshed.locator(".pr-review-line")).toHaveText("Review Status: Pending Admin Approval", { timeout: 20_000 });
  await refreshed.getByRole("button", { name: /^View / }).click();
  const drawer = page.getByRole("dialog", { name: /Planting report/ });
  await expect(drawer.locator(".pr-submission-item")).toHaveCount(6, { timeout: 20_000 }); // original + two corrections, two types each
  // History: exactly two Staff resubmissions (the earlier replayed one and this one).
  await expect(drawer.getByText("Staff Resubmission", { exact: true })).toHaveCount(2);
  expect(problems).toEqual([]);
});
