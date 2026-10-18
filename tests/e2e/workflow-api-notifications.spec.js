import { expect, test } from "@playwright/test";

const PASSWORD = "Workflow-Test-Only!2026";
const email = (role) => `workflow-api-acceptance.${role}@example.test`;

async function login(page, role) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email(role));
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator("button.login-primary-btn").click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await expect(page).toHaveURL(new RegExp(`/${role === "other" ? "participant" : role}/`), { timeout: 20_000 });
}

async function openNotice(page, title) {
  const trigger = page.getByRole("button", { name: "Notifications", exact: true });
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await trigger.click();
  const panel = page.locator(".notification-panel");
  await expect(panel).toBeVisible();
  const notice = panel.getByText(title, { exact: true }).first();
  await expect(notice).toBeVisible({ timeout: 20_000 });
  await notice.locator("xpath=ancestor::button[1]").click();
  await expect(page.getByRole("heading", { name: "Notification Details" })).toBeVisible();
  await page.getByRole("button", { name: "Open Related Record" }).click();
}

test.describe.serial("Generated workflow notification acceptance", () => {
  test("requester opens the actual release notification and unrelated participant cannot retrieve it", async ({ browser, page }) => {
    await login(page, "participant");
    await openNotice(page, "Seedlings Released");
    await expect(page).toHaveURL(/\/participant\/my-requests\?request=/);
    await expect(page.getByText("Acceptance approved", { exact: false }).first()).toBeVisible();

    const unrelatedContext = await browser.newContext();
    const unrelatedPage = await unrelatedContext.newPage();
    await login(unrelatedPage, "other");
    await unrelatedPage.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(unrelatedPage.locator(".notification-panel").getByText("Seedlings Released", { exact: true })).toHaveCount(0);
    await unrelatedContext.close();
  });

  test("Staff opens the actual flagged planting contribution", async ({ page }) => {
    await login(page, "staff");
    await openNotice(page, "Planting Evidence Requires Review");
    await expect(page).toHaveURL(/\/staff\/planting-reports\?report=.*contribution=/);
    await expect(page.getByRole("heading", { name: "Planting Report Details" })).toBeVisible();
  });

  test("Administrator opens the actual out-of-stock inventory alert", async ({ page }) => {
    await login(page, "admin");
    await openNotice(page, "Seedling Stock Depleted");
    await expect(page).toHaveURL(/\/admin\/seedlings\?inventory=/);
    await expect(page.getByText("Workflow API acceptance batch", { exact: false }).first()).toBeVisible();
  });
});
