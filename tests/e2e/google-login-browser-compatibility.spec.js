import { expect, test } from "@playwright/test";
import process from "node:process";

const FRONTEND = process.env.MENRO_AUTH_COMPAT_FRONTEND || "http://127.0.0.1:5174";

if (!/^http:\/\/(?:127\.0\.0\.1|localhost):517[34]$/.test(FRONTEND)) {
  throw new Error("Google-login browser compatibility tests require an approved loopback frontend endpoint.");
}

test("Chrome keeps Google Login available without embedded-browser recovery guidance", async ({ page }) => {
  await page.goto(`${FRONTEND}/login`);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  await expect(page.locator(".login-browser-notice")).toHaveCount(0);
});

test.describe("Messenger in-app browser", () => {
  test.use({
    userAgent: "Mozilla/5.0 (Linux; Android 13; SM-A025F) AppleWebKit/537.36 [FB_IAB/MESSENGER;FBAV/450.0] Mobile Safari/537.36",
  });

  test("shows recovery guidance and does not start Google popup sign-in", async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    await expect(page.locator(".login-browser-notice")).toContainText("Open in browser or Open in Chrome");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.locator(".login-error")).toContainText("same browser");
  });
});
