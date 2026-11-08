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
  await expect(page.getByRole("link", { name: "reload this page" })).toBeVisible({ timeout: 13000 });
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

const fixtureOnly = page => page.route("**/*", route => new URL(route.request().url()).origin === "http://127.0.0.1:5189" ? route.continue() : route.abort());
const delayAppChunk = (page, milliseconds) => page.route(/\/assets\/renderApp-.*\.js$/, async route => {
  if (milliseconds === Infinity) return new Promise(() => {});
  await new Promise(resolve => setTimeout(resolve, milliseconds));
  return route.continue();
});

for (const path of ["/", "/login"]) test("a normal startup never flashes the loading fallback at " + path, async ({ page }) => {
  await fixtureOnly(page); await delayAppChunk(page, 1200);
  await page.addInitScript(() => {
    window.__fallbackSeen = null;
    const watch = () => {
      for (const panel of document.querySelectorAll(".startup-panel")) {
        if (panel.checkVisibility({ visibilityProperty: true, opacityProperty: true })) window.__fallbackSeen ??= panel.textContent.trim().slice(0, 60);
      }
      if (!window.__appVisible) requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await page.goto("http://127.0.0.1:5189" + path);
  await expect(page.getByRole("link", { name: /Get Started/ }).or(page.locator("#login-email")).first()).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { window.__appVisible = true; });
  expect(await page.evaluate(() => window.__fallbackSeen)).toBeNull();
});

// Times are taken inside the page, from when each element first exists to when it is first visible.
const trackReveal = page => page.addInitScript(() => {
  window.__reveal = {};
  const record = (key, element) => {
    const entry = window.__reveal[key] ??= { present: performance.now(), visible: null };
    if (entry.visible === null && element.checkVisibility({ visibilityProperty: true })) entry.visible = performance.now();
  };
  const watch = () => {
    for (const panel of document.querySelectorAll(".startup-panel")) record(panel.querySelector("h1")?.textContent || "panel", panel);
    for (const hint of document.querySelectorAll(".startup-reload-hint")) record("reload hint", hint);
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
});
const revealDelay = async (page, key, timeout) => {
  await page.waitForFunction(name => window.__reveal?.[name]?.visible !== null && window.__reveal?.[name]?.visible !== undefined, key, { timeout });
  return page.evaluate(name => window.__reveal[name].visible - window.__reveal[name].present, key);
};

test("a stalled startup shows the loading message first and the reload link later", async ({ page }) => {
  test.setTimeout(45000);
  await fixtureOnly(page); await delayAppChunk(page, Infinity); await trackReveal(page);
  await page.goto("http://127.0.0.1:5189/", { waitUntil: "commit" });
  const panelDelay = await revealDelay(page, "Loading MENRO", 8000);
  expect(panelDelay).toBeGreaterThanOrEqual(1900); expect(panelDelay).toBeLessThan(3500);
  await expect(page.getByRole("heading", { name: "Loading MENRO" })).toBeVisible();
  const reloadDelay = await revealDelay(page, "reload hint", 15000);
  expect(reloadDelay).toBeGreaterThanOrEqual(9900); expect(reloadDelay).toBeLessThan(11500);
  await expect(page.getByRole("link", { name: "reload this page" })).toBeVisible();
});

test("checking your sign-in waits briefly before appearing on a protected route", async ({ page }) => {
  await fixtureOnly(page); await trackReveal(page);
  await page.addInitScript(() => sessionStorage.setItem("fixture-auth-loading", "true"));
  await page.goto("http://127.0.0.1:5189/staff/dashboard", { waitUntil: "commit" });
  const delay = await revealDelay(page, "Checking your sign-in", 12000);
  expect(delay).toBeGreaterThanOrEqual(1900); expect(delay).toBeLessThan(3500);
  await expect(page.getByRole("heading", { name: "Checking your sign-in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reload page" })).toBeHidden();
});
