import { expect, test } from "@playwright/test";

// Requires backend fixtures: `node tests/integration/seedPlantingViewReportBrowserAcceptance.js`
// (menrobackend), which also seeds an unreported two-type release
// (Narra 8 + Molave 4 at "View Report Form Site") for this Participant.
const FRONTEND = "http://127.0.0.1:5173";
const PASSWORD = "Planting-View-Browser!2026";

async function selectByText(select, text) {
  await expect.poll(() => select.locator("option").evaluateAll((options, wanted) =>
    options.some((option) => option.textContent.includes(wanted) && !option.disabled), text), { timeout: 20_000 }).toBe(true);
  const value = await select.locator("option").evaluateAll((options, wanted) =>
    options.find((option) => option.textContent.includes(wanted) && !option.disabled).value, text);
  await select.selectOption(value);
}

test("participant final report lists every released type, computes planted, and requires a reason for leftovers", async ({ page }) => {
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  await page.goto(`${FRONTEND}/login`);
  await page.getByLabel("Email Address").fill("planting-view.participant@example.test");
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator(".login-primary-btn").click();
  await expect(page).toHaveURL(/\/participant\//);
  // Let the post-login dashboard redirect settle before navigating.
  await expect(page.getByText(/^Welcome, /)).toBeVisible({ timeout: 20_000 });
  await page.goto(`${FRONTEND}/participant/my-planting-reports`);
  await expect(page.getByRole("heading", { name: "My Planting Reports" })).toBeVisible({ timeout: 20_000 });
  const openForm = page.getByRole("button", { name: "Submit Planting Report", exact: true });
  await expect(openForm).toBeEnabled({ timeout: 20_000 });
  await openForm.click();

  const form = page.locator("form").filter({ has: page.locator("#planting-distributionId") });
  await expect(form).toBeVisible({ timeout: 20_000 });
  await selectByText(form.locator("#planting-barangay"), "Bical");
  await selectByText(form.locator("#planting-siteId"), "View Report Form Site");
  await selectByText(form.locator("#planting-eventId"), "View Report form planting");
  await selectByText(form.locator("#planting-distributionId"), "Narra, Molave");

  // One final report: every released type, Final Planted = Available - Leftovers.
  const table = form.locator(".pr-final-report-table");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(table.locator("tbody tr").nth(0)).toContainText("Narra");
  await expect(table.locator("tbody tr").nth(1)).toContainText("Molave");
  await expect(form.locator("#planting-distributionItemKey")).toHaveCount(0, { timeout: 1 });
  await expect(table.locator(".pr-final-planted")).toHaveText(["8", "4"]);
  await expect(form.locator('[id^="planting-leftoverReason-"]')).toHaveCount(0);

  const narraLeftover = form.locator('input[id^="planting-leftoverQuantity-"]').first();
  await narraLeftover.fill("3");
  await expect(table.locator(".pr-final-planted")).toHaveText(["5", "4"]);
  await expect(table.locator("tfoot")).toContainText("9");
  const reason = form.locator('textarea[id^="planting-leftoverReason-"]');
  await expect(reason).toHaveCount(1);

  // Submitting without the reason is refused on that seedling type.
  await form.locator('button[type="submit"]').click();
  await expect(form.locator('[id^="planting-error-leftoverReason-"]')).toHaveText("Enter the reason for the leftover seedlings.");
  await reason.fill("Three seedlings were damaged in transport");
  await expect(form.locator('[id^="planting-error-leftoverReason-"]')).toHaveCount(0);

  // Leftovers above the available balance are refused and show no planted number.
  const molaveLeftover = form.locator('input[id^="planting-leftoverQuantity-"]').nth(1);
  await molaveLeftover.fill("5");
  await expect(table.locator(".pr-final-planted").nth(1)).toHaveText("—");
  await form.locator('button[type="submit"]').click();
  await expect(form.locator('[id^="planting-error-leftoverQuantity-"]')).toContainText("Leftover cannot exceed the 4 seedlings available.");
  await molaveLeftover.fill("0");
  await expect(table.locator(".pr-final-planted")).toHaveText(["5", "4"]);
  expect(problems).toEqual([]);
});
