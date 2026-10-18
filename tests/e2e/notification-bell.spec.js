import { expect, test } from "@playwright/test";

const PASSWORD = "Phase2-Test-Only!2026";
const USERS = {
  participant: ["phase2.participant@example.test", "phase2-participant"],
  staff: ["phase2.staff@example.test", "phase2-staff"],
  admin: ["phase2.admin@example.test", "phase2-admin"],
};

async function login(page, role) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(USERS[role][0]);
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator("button.login-primary-btn").click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

function bell(page) { return page.getByRole("button", { name: "Notifications", exact: true }); }
function panel(page) { return page.locator(".notification-panel"); }

test.describe.serial("Notification Bell acceptance", () => {
  test("Participant filters, pagination, details, read actions, layout, and ordering work", async ({ page }) => {
    await login(page, "participant");
    await expect.poll(async () => Number(await bell(page).locator(".notification-badge").textContent()), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(25);
    await bell(page).focus();
    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).locator("#notification-category")).toHaveCount(0);
    await expect(panel(page).getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
    await expect(panel(page).locator(".notification-item")).toHaveCount(20);
    const newestFixture = panel(page).getByText("Participant notice 24", { exact: true });
    await expect(newestFixture).toBeVisible();
    await expect(panel(page).getByRole("button", { name: "Load more" })).toBeVisible();

    const footer = panel(page).locator(".notification-footer");
    const closeBox = await footer.getByRole("button", { name: "Close" }).boundingBox();
    const markBox = await footer.getByRole("button", { name: "Mark all as read" }).boundingBox();
    expect(closeBox.x).toBeLessThan(markBox.x);

    await newestFixture.locator("xpath=ancestor::button[1]").click();
    await expect(page.getByRole("heading", { name: "Notification Details" })).toBeVisible();
    await page.keyboard.press("Escape");
    await bell(page).click();
    await panel(page).getByRole("tab", { name: "Read", exact: true }).click();
    await expect(panel(page).getByText("Participant notice 24", { exact: true })).toBeVisible();
    await panel(page).getByRole("tab", { name: "Unread", exact: true }).click();
    await expect(panel(page).locator(".notification-item")).toHaveCount(20);
    await panel(page).getByRole("button", { name: "Mark all as read" }).click();
    await expect(panel(page).getByText("No unread notifications in this view.")).toBeVisible();
    await expect(bell(page).locator(".notification-badge")).toHaveCount(0);
    await panel(page).getByRole("button", { name: "Close" }).click();
    await expect(panel(page)).toHaveCount(0);
  });

  for (const role of ["staff", "admin"]) {
    test(`${role} sees only the authenticated recipient's notifications`, async ({ page }) => {
      await login(page, role);
      await bell(page).click();
      await expect(panel(page).getByText(`${role} private notice`, { exact: true })).toBeVisible();
      await expect(panel(page).getByText("Participant notice 24", { exact: true })).toHaveCount(0);
    });
  }

  test("mobile Notification Bell remains usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, "staff");
    await bell(page).click();
    await expect(panel(page)).toBeVisible();
    const box = await panel(page).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await expect(panel(page).getByRole("button", { name: "Close" })).toBeVisible();
    await expect(panel(page).getByRole("button", { name: "Mark all as read" })).toBeVisible();
  });
});
