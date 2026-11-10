import { expect, test } from "@playwright/test";

// Requires backend fixtures: `node tests/integration/seedPlantingViewReportBrowserAcceptance.js`
// (menrobackend) which saves one real geotagged Participant submission.
const FRONTEND = "http://127.0.0.1:5173";
const PASSWORD = "Planting-View-Browser!2026";
const ACCOUNTS = [
  ["staff", "planting-view.staff@example.test"],
  ["admin", "planting-view.admin@example.test"],
];

for (const [role, email] of ACCOUNTS) {
  test(`${role} View Report shows the saved submission, evidence photo and map marker`, async ({ page }) => {
    const problems = [];
    page.on("pageerror", (error) => problems.push(error.message));

    await page.goto(`${FRONTEND}/login`);
    await page.getByLabel("Email Address").fill(email);
    await page.locator("#login-password").fill(PASSWORD);
    await page.locator(".login-primary-btn").click();
    await expect(page).toHaveURL(new RegExp(`/${role}/`));

    for (const pass of ["initial", "after reload"]) {
      if (pass === "after reload") await page.reload();
      else await page.goto(`${FRONTEND}/${role}/planting-reports`);

      const row = page.locator("tr", { hasText: "View Report Browser Site" });
      await expect(row).toHaveCount(1, { timeout: 20_000 });
      await expect(row.locator(".pr-status-badge")).toHaveText("Submitted");
      await expect(row).toContainText("Review: Pending Review");
      await row.getByRole("button", { name: /^View / }).click();

      const drawer = page.getByRole("dialog", { name: /Planting report/ });
      await expect(drawer).toBeVisible();
      const heading = drawer.locator(".pr-drawer-heading-meta .pr-status-badge");
      await expect(heading).toHaveText(["Submitted", "Pending Review"]);
      await expect(heading.first()).toHaveClass(/pr-status-approved/);
      await expect(heading.nth(1)).not.toHaveClass(/pr-status-approved/);
      await expect(drawer).not.toContainText("No individual submissions are available");
      await expect(drawer).not.toContainText("No evidence submitted yet");
      await expect(drawer).not.toContainText("Not yet submitted");

      const submission = drawer.locator(".pr-submission-item");
      await expect(submission).toHaveCount(1);
      await expect(submission).toContainText("Browser Planter");
      await expect(submission).toContainText("Narra");
      await expect(submission).toContainText("12.671");
      await expect(submission).toContainText("Pending Review");

      // Secure evidence image actually decoded (served via authenticated endpoint).
      const image = drawer.locator("img.pr-drawer-photo").first();
      await expect(image).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);

      // Saved evidence location on the existing Bulan evidence map.
      const mapSection = drawer.locator(".pr-evidence-map-section");
      await mapSection.scrollIntoViewIfNeeded();
      await expect(mapSection.locator(".pr-evidence-map")).toBeVisible();
      await expect(mapSection.locator("path.leaflet-interactive")).not.toHaveCount(0);
      await expect(mapSection.locator(".pr-location-map-legend")).toContainText(/(Verified|Unverified) \(1\)/);

      await drawer.locator(".pr-drawer-close").click();
    }
    expect(problems).toEqual([]);
  });
}
