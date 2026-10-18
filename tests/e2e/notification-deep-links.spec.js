import { expect, test } from "@playwright/test";

const PASSWORD = "Phase2-Test-Only!2026";
const email = (role) => `phase2.${role === "participant" ? "participant" : role}@example.test`;

async function login(page, role) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email(role));
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator("button.login-primary-btn").click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function openRelated(page, title) {
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  const panel = page.locator(".notification-panel");
  await expect(panel).toBeVisible();
  await panel.getByText(title, { exact: true }).locator("xpath=ancestor::button[1]").click();
  await expect(page.getByRole("heading", { name: "Notification Details" })).toBeVisible();
  await page.getByRole("button", { name: "Open Related Record" }).click();
}

test.describe.serial("Cross-module notification deep links", () => {
  test("Administrator opens every exact operational record", async ({ page }) => {
    await login(page, "admin");
    const cases = [
      ["Closure request", /\/admin\/requests\?request=closure-request-a/, "Closure acceptance"],
      ["Closure report", /\/admin\/planting-reports\?report=closure-report-a/, "closure-contribution-a"],
      ["Closure contribution", /contribution=closure-contribution-a/, "closure-contribution-a"],
      ["Closure monitoring", /observation=closure-observation-a/, "closure-observation-a"],
      ["Closure event", /\/admin\/event-calendar\?event=closure-event-a/, "Closure Manual Event"],
      ["Closure inventory", /\/admin\/seedlings\?inventory=closure-inventory/, "CLOSURE-BATCH-001"],
      ["Closure distribution", /distribution=closure-distribution/, "CLOSURE-DIST-001"],
    ];
    for (const [title, url, visibleText] of cases) {
      await page.goto("/admin/dashboard");
      await openRelated(page, title);
      await expect(page).toHaveURL(url, { timeout: 15_000 });
      await expect(page.getByText(visibleText, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test("Staff opens every exact operational record", async ({ page }) => {
    await login(page, "staff");
    const cases = [
      ["Closure request", /\/staff\/requests\?request=closure-request-a/, "Closure acceptance"],
      ["Closure report", /\/staff\/planting-reports\?report=closure-report-a/, "closure-contribution-a"],
      ["Closure contribution", /contribution=closure-contribution-a/, "closure-contribution-a"],
      ["Closure monitoring", /observation=closure-observation-a/, "closure-observation-a"],
      ["Closure event", /\/staff\/event-calendar\?event=closure-event-a/, "Closure Manual Event"],
      ["Closure inventory", /\/staff\/seedlings\?inventory=closure-inventory/, "CLOSURE-BATCH-001"],
      ["Closure distribution", /distribution=closure-distribution/, "CLOSURE-DIST-001"],
    ];
    for (const [title, url, visibleText] of cases) {
      await page.goto("/staff/dashboard");
      await openRelated(page, title);
      await expect(page).toHaveURL(url, { timeout: 15_000 });
      await expect(page.getByText(visibleText, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test("Participant opens owned records but modified IDs do not disclose another participant", async ({ page }) => {
    await login(page, "participant");
    for (const [title, url, text] of [
      ["Closure request", /\/participant\/my-requests\?request=closure-request-a/, "Closure acceptance"],
      ["Closure report", /\/participant\/my-planting-reports\?report=closure-report-a/, "closure-contribution-a"],
      ["Closure monitoring", /observation=closure-observation-a/, "closure-observation-a"],
      ["Closure event", /\/participant\/event-calendar\?event=closure-event-a/, "Closure Manual Event"],
    ]) {
      await page.goto("/participant/dashboard");
      await openRelated(page, title);
      await expect(page).toHaveURL(url, { timeout: 15_000 });
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    }
    await page.goto("/participant/my-requests?request=closure-request-b");
    await expect(page.getByText("CLOSURE-REQ-B", { exact: false })).toHaveCount(0);
    await page.goto("/participant/my-planting-reports?report=closure-report-b");
    await expect(page.getByText("CLOSURE-REPORT-B", { exact: false })).toHaveCount(0);
  });
});
