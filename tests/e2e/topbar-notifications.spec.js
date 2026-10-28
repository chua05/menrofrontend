import { expect, test } from "@playwright/test";

const FRONTEND = "http://127.0.0.1:5173";
const EMAIL = "request-letter.browser.participant@example.test";
const PASSWORD = "Request-Letter-Browser!2026";

test("opening unread and marking all synchronize Topbar and Sidebar without React loops", async ({ page }) => {
  const reactProblems = [];
  page.on("console", (message) => {
    if (!["warning", "error"].includes(message.type())) return;
    const text = message.text();
    if (/maximum update depth|cannot update a component while rendering|too many re-renders/i.test(text)) {
      reactProblems.push(text);
    }
  });
  page.on("pageerror", (error) => reactProblems.push(error.message));

  await page.goto(`${FRONTEND}/login`);
  await page.getByLabel("Email Address").fill(EMAIL);
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator(".login-primary-btn").click();
  await expect(page).toHaveURL(/\/participant\//);

  const bell = page.getByRole("button", { name: "Notifications" });
  await expect(bell.locator(".notification-badge")).toBeVisible({ timeout: 15_000 });
  const requestLink = page.locator('a[href="/participant/my-requests"]');
  const initialUnread = Number(await bell.locator(".notification-badge").textContent());
  expect(initialUnread).toBeGreaterThanOrEqual(2);
  await expect(requestLink.locator(".sb-item-badge")).toHaveText(String(initialUnread));

  await bell.click();
  await page.locator(".notification-item.unread").first().click();
  await expect(page.getByRole("dialog", { name: "Notification Details" })).toBeVisible();
  await expect(bell.locator(".notification-badge")).toHaveText(String(initialUnread - 1));
  await expect(requestLink.locator(".sb-item-badge")).toHaveText(String(initialUnread - 1));
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await bell.click();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(bell.locator(".notification-badge")).toHaveCount(0);
  await expect(requestLink.locator(".sb-item-badge")).toHaveCount(0);
  await expect(page.locator(".notification-item.unread")).toHaveCount(0);
  expect(reactProblems).toEqual([]);
});
