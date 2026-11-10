import { expect, test } from "@playwright/test";

// Requires backend fixtures: `node tests/integration/seedPlantingViewReportBrowserAcceptance.js`
// (menrosystem backend), which saves a Staff final report (release-based) at
// "View Report Staff Site": Narra 10 released (1 leftover, reason) + Molave 5.
// Admin returns two specific fields -> Staff corrects only those -> Admin approves.
const FRONTEND = "http://127.0.0.1:5173";
const PASSWORD = "Planting-View-Browser!2026";
const SITE = "View Report Staff Site";
const NARRA = "planting-view-browser-staff-narra";

test.describe.configure({ mode: "serial" });

async function login(page, role) {
  await page.goto(`${FRONTEND}/login`);
  await page.getByLabel("Email Address").fill(`planting-view.${role}@example.test`);
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator(".login-primary-btn").click();
  await expect(page).toHaveURL(new RegExp(`/${role}/`));
  await page.goto(`${FRONTEND}/${role}/planting-reports`);
}

async function openReport(page, reviewStatus) {
  const row = page.locator("tr", { hasText: SITE });
  await expect(row).toHaveCount(1, { timeout: 20_000 });
  await expect(row.locator(".pr-review-line")).toHaveText(`Review Status: ${reviewStatus}`);
  await row.getByRole("button", { name: /^View / }).click();
  const drawer = page.getByRole("dialog", { name: /Planting report/ });
  await expect(drawer).toBeVisible();
  return drawer;
}

function watchErrors(page) {
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  return problems;
}

test("Admin returns specific submitted fields, each with a required comment", async ({ page }) => {
  const problems = watchErrors(page);
  await login(page, "admin");
  const drawer = await openReport(page, "Pending Admin Approval");
  await expect(drawer.locator(".pr-submission-item")).toHaveCount(2);
  await expect(drawer.getByRole("button", { name: "Return for Correction", exact: true })).toHaveCount(1);
  await drawer.getByRole("button", { name: "Return for Correction", exact: true }).click();

  const modal = page.locator(".pr-decision-modal");
  await expect(modal).toBeVisible();
  const fields = modal.locator(".pr-correction-field");
  // Only actual submitted fields: no planted quantity, event, site or date; no photos on a release-based report.
  await expect(fields.locator("strong")).toHaveText(["Narra — Final Leftovers", "Narra — Leftover Reason", "Molave — Final Leftovers", "Confirmation Basis", "Remarks"]);
  await modal.locator("#pr-decision-reason").fill("Two values need correcting");
  await modal.getByRole("button", { name: "Return for Correction", exact: true }).click();
  await expect(modal.getByText("Select at least one field that needs correction.")).toBeVisible();

  await modal.locator(`[data-field-path="items.${NARRA}.leftoverQuantity"] input[type="checkbox"]`).check();
  await modal.locator('[data-field-path="remarks"] input[type="checkbox"]').check();
  await modal.locator(`[data-field-path="items.${NARRA}.leftoverQuantity"] textarea`).fill("The field sheet shows 2 leftovers");
  await modal.getByRole("button", { name: "Return for Correction", exact: true }).click();
  await expect(modal.locator('[data-field-path="remarks"]')).toContainText("Enter what needs to be corrected.");
  await modal.locator('[data-field-path="remarks"] textarea').fill("Name who attended");
  await modal.getByRole("button", { name: "Return for Correction", exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 20_000 });

  await expect(drawer.locator(".pr-drawer-heading-meta .pr-status-badge")).toHaveText(["Submitted", "Returned for Correction"]);
  const request = drawer.locator(".pr-correction-request").first();
  await expect(request).toContainText("Narra — Final Leftovers: The field sheet shows 2 leftovers");
  await expect(request).toContainText("Remarks: Name who attended");
  await drawer.locator(".pr-drawer-close").click();
  expect(problems).toEqual([]);
});

test("Staff can edit only the returned fields and resubmits directly to Admin", async ({ page }) => {
  const problems = watchErrors(page);
  await login(page, "staff");
  const drawer = await openReport(page, "Returned for Correction");
  await drawer.getByRole("button", { name: "Correct Official Submission" }).click();
  const form = page.locator(".pr-official-dialog");
  await expect(form).toBeVisible({ timeout: 20_000 });
  await expect(form.locator(".pr-correction-banner")).toContainText("Only these fields can be changed");

  const narraLeftover = form.locator("#official-leftover-0"), molaveLeftover = form.locator("#official-leftover-1");
  await expect(narraLeftover).toHaveValue("1", { timeout: 20_000 });
  await expect(form.locator("#official-leftoverReason-0")).toHaveValue("One seedling wilted");
  await expect(narraLeftover).not.toHaveAttribute("readonly");
  await expect(molaveLeftover).toHaveAttribute("readonly", "");
  await expect(form.locator("select").filter({ has: page.locator('option[value="release-based"]') })).toBeDisabled();
  await expect(form.locator("#official-remarks")).not.toHaveAttribute("readonly");
  await expect(form.locator("#official-remarks")).toHaveValue("Planted with the requester");
  await expect(form).toContainText("Admin: The field sheet shows 2 leftovers");

  await narraLeftover.fill("2");
  await form.locator("#official-leftoverReason-0").fill("Two seedlings wilted");
  await form.locator("#official-remarks").fill("Planted with the requester and Kagawad Reyes");
  await form.getByRole("button", { name: "Submit for Admin Verification" }).click();
  await expect(form).toBeHidden({ timeout: 20_000 });

  const row = page.locator("tr", { hasText: SITE });
  await expect(row.locator(".pr-review-line")).toHaveText("Review Status: Pending Admin Approval", { timeout: 20_000 });
  expect(problems).toEqual([]);
});

test("Admin sees the corrected revision with history and approves it to Completed", async ({ page }) => {
  const problems = watchErrors(page);
  await login(page, "admin");
  const drawer = await openReport(page, "Pending Admin Approval");
  const items = drawer.locator(".pr-submission-item");
  await expect(items).toHaveCount(4, { timeout: 20_000 }); // returned revision (history) + corrected revision
  await expect(drawer).toContainText("Two seedlings wilted");
  await expect(drawer.getByRole("button", { name: "Approve", exact: true })).toHaveCount(1);
  await drawer.getByRole("button", { name: "Approve", exact: true }).click();
  const modal = page.locator(".pr-decision-modal");
  await modal.getByRole("button", { name: "Approve Report" }).click();
  await expect(modal).toBeHidden({ timeout: 20_000 });
  await expect(drawer.locator(".pr-drawer-heading-meta .pr-status-badge")).toHaveText(["Submitted", "Completed"]);
  await drawer.locator(".pr-drawer-close").click();
  const row = page.locator("tr", { hasText: SITE });
  await expect(row.locator(".pr-review-line")).toHaveText("Review Status: Completed");
  await expect(row).toContainText("13 reported planted / 15 released"); // Narra 10 - 2 leftovers + Molave 5
  expect(problems).toEqual([]);
});
