import { test, expect } from "@playwright/test";
for (const mode of ["import", "render", "success"]) test("startup boundary: " + mode, async ({ page }) => {
  const external = [];
  await page.route("**/*", route => { if (new URL(route.request().url()).origin !== "http://127.0.0.1:5187") { external.push(route.request().url()); return route.abort(); } return route.continue(); });
  await page.goto("http://127.0.0.1:5187/?mode=" + mode);
  await expect(page.getByRole("heading", { name: mode === "success" ? "Application mounted" : "Unable to load MENRO" })).toBeVisible();
  if (mode !== "success") { await expect(page.getByRole("alert")).not.toContainText("Test-only"); await expect(page.getByRole("link", { name: "Reload page" })).toHaveAttribute("href", ""); }
  expect(external).toEqual([]);
});
test("real Firebase initialization failure displays a safe startup fallback", async ({ page }) => {
  const errors = [], external = []; page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => { if (new URL(route.request().url()).origin !== "http://127.0.0.1:5188") { external.push(route.request().url()); return route.abort(); } return route.continue(); });
  await page.goto("http://127.0.0.1:5188/login");
  await expect(page.getByRole("heading", { name: "Unable to load MENRO" })).toBeVisible();
  await expect(page.getByRole("alert")).not.toContainText("apiKey");
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
test("blocked entry JavaScript leaves readable recovery instructions", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
  await page.route("**/*", route => new URL(route.request().url()).origin === "http://127.0.0.1:5188" ? route.continue() : route.abort());
  await page.goto("http://127.0.0.1:5188/login");
  await expect(page.getByRole("heading", { name: "Loading MENRO" })).toBeVisible();
  await expect(page.getByRole("link", { name: "reload this page" })).toBeVisible();
  await context.close();
});

for (const blockedChunk of [false, true]) test("compiled fixture login: " + (blockedChunk ? "blocked application chunk" : "healthy"), async ({ page }) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:5189") return route.abort();
    if (blockedChunk && /\/assets\/renderApp-.*\.js$/.test(url.pathname)) return route.abort();
    return route.continue();
  });
  await page.goto("http://127.0.0.1:5189/login");
  if (blockedChunk) await expect(page.getByRole("heading", { name: "Unable to load MENRO" })).toBeVisible();
  else await expect(page.locator("#login-email")).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [390, 1440]) test("compiled Get Started reaches login without reload during pending session at " + width, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => new URL(route.request().url()).origin === "http://127.0.0.1:5189" ? route.continue() : route.abort());
  await page.addInitScript(() => sessionStorage.setItem("fixture-auth-loading", "true"));
  await page.goto("http://127.0.0.1:5189/");
  await page.evaluate(() => { window.__getStartedDocument = "same-document"; });
  await page.getByRole("link", { name: /Get Started/ }).first().click();
  await expect(page).toHaveURL("http://127.0.0.1:5189/login");
  await expect(page.locator("#login-email")).toBeVisible();
  await expect(page.locator("#login-password")).toBeVisible();
  expect(await page.evaluate(() => window.__getStartedDocument)).toBe("same-document");
  await expect(page.getByRole("heading", { name: "Checking your sign-in" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
