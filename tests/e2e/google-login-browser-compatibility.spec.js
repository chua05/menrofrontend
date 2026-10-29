import { expect, test } from "@playwright/test";
import process from "node:process";

const FRONTEND = process.env.MENRO_AUTH_COMPAT_FRONTEND || "http://127.0.0.1:5174";

if (!/^http:\/\/(?:127\.0\.0\.1|localhost):517[34]$/.test(FRONTEND)) {
  throw new Error("Google-login browser compatibility tests require an approved loopback frontend endpoint.");
}

test("Chrome keeps Google Login available without embedded-browser recovery guidance", async ({ page }) => {
  await page.goto(`${FRONTEND}/login`);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await popupPromise;
  await popup.close();
});

test.describe("Messenger in-app browser", () => {
  test.use({
    userAgent: "Mozilla/5.0 (Linux; Android 13; SM-A025F) AppleWebKit/537.36 [FB_IAB/MESSENGER;FBAV/450.0] Mobile Safari/537.36",
  });

  test("does not preemptively block Google sign-in or show recovery guidance", async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    const popup = await popupPromise;
    await popup.close();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
