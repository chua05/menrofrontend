import { expect, test } from "@playwright/test";

const request = { id: "release-fixture", requestNumber: "REQ-2026-001", participantName: "Fixture requester", status: "Approved", requestVersion: 4,
  items: [{ inventoryId: "narra", species: "Narra", quantity: 10 }], proposedDate: "2099-01-01", plantingSiteName: "Fixture site" };
async function fixture(page, overrides = {}) {
  const unexpected = [], external = [], warnings = [], calls = [];
  page.on("console", message => {
    if (["warning", "error"].includes(message.type())) warnings.push({ text: message.text(), source: message.location().url });
  });
  const browserLog = await page.context().newCDPSession(page);
  browserLog.on("Log.entryAdded", ({ entry }) => {
    if (["warning", "error"].includes(entry.level)) warnings.push({ text: entry.text, source: entry.url || entry.source });
  });
  await browserLog.send("Log.enable");
  await page.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== "http://127.0.0.1:5184") { external.push(url.origin); return route.abort(); }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const key = `${req.method()} ${url.pathname}`; calls.push(key);
    if (overrides[key]) return overrides[key](route, req);
    let data;
    if (key === "GET /api/seedling-requests") data = [request];
    else if (key === "GET /api/inventory") data = [{ id: "narra", species: "Narra", availableQuantity: 100, reservedQuantity: 0 }];
    else if (url.pathname === "/api/notifications/unread-count") data = { unreadCount: 2 };
    else if (url.pathname === "/api/notifications") data = { notifications: [], unreadCount: 2, hasMore: false, nextCursor: null };
    else if (url.pathname === "/api/search") data = { results: [{ id: "release-fixture", title: "Fixture request", type: "Sapling Request", path: "/staff/requests" }] };
    else if (url.pathname === "/api/auth/profile") data = { uid: "test-staff", fullName: "Fixture Staff" };
    else if (url.pathname === "/api/sites") data = [];
    else if (["/api/planting-reports", "/api/planting-reports/my-reports", "/api/events", "/api/monitoring", "/api/monitoring/my-records", "/api/users", "/api/distributions"].includes(url.pathname)) data = [];
    else if (["/api/seedling-requests/my", "/api/seedling-requests/my-requests"].includes(url.pathname)) data = [];
    else { unexpected.push(key); return route.fulfill({ status: 500, json: { success: false, message: "Unregistered request" } }); }
    return route.fulfill({ json: { success: true, data } });
  });
  return { calls, warnings, check() {
    const extension = warnings.filter(row => /^(chrome|moz)-extension:|content[-_]?script/i.test(row.source));
    const application = warnings.filter(row => !extension.includes(row));
    test.info().annotations.push({ type: "console-audit", description: JSON.stringify({ extension: extension.length, applicationOrBrowser: application.length }) });
    expect(unexpected).toEqual([]); expect(external).toEqual([]);
    expect(application.filter(row => /Blocked aria-hidden|Functions are not valid as a React child|Cannot update a component/i.test(row.text))).toEqual([]);
  } };
}
async function openRelease(page) {
  await page.goto("/staff/requests?role=staff");
  await page.getByRole("button", { name: "View details for REQ-2026-001" }).click();
  const trigger = page.getByRole("button", { name: "Release Seedlings", exact: true }); await trigger.click();
  return { trigger, dialog: page.getByRole("dialog", { name: "Release seedlings", exact: true }) };
}

test("Release dialog moves focus, traps both Tab directions, closes on Escape and restores its trigger", async ({ page }) => {
  const state = await fixture(page); const { trigger, dialog } = await openRelease(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveJSProperty("open", true);
  await page.locator(".topbar-menu-btn").evaluate(node => node.focus());
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  const buttons = dialog.locator('button:not([disabled]),input:not([disabled]),textarea:not([disabled])');
  await buttons.first().focus(); await page.keyboard.press("Shift+Tab");
  await expect(buttons.last()).toBeFocused();
  await buttons.last().focus(); await page.keyboard.press("Tab");
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await trigger.click(); await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(trigger).toBeFocused();
  state.check();
});

for (const role of ["admin", "staff", "participant"]) test(`actual ${role} dashboard renders the shared forest header`, async ({ page }) => {
  const state = await fixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/${role}/dashboard?role=${role}`);
  await expect(page.locator(".dashboard-kpi-grid")).toBeVisible();
  if (role === "participant") await expect(page.getByRole("heading", { name: "Welcome, Test User!" })).toBeVisible();
  const header = page.locator("header.topbar"); await expect(header).toHaveCount(1);
  await expect(header).toHaveCSS("background-color", "rgb(20, 91, 58)");
  const genericOverride = await page.addStyleTag({ content: ".topbar { background: white; }" });
  await expect(header).toHaveCSS("background-color", "rgb(20, 91, 58)");
  await genericOverride.evaluate(node => node.remove());
  await header.evaluate(node => node.style.setProperty("--menro-forest", "initial"));
  await expect(header).toHaveCSS("background-color", "rgb(20, 91, 58)");
  await header.evaluate(node => node.style.removeProperty("--menro-forest"));
  await expect(header.locator(".topbar-avatar")).toHaveCSS("background-color", "rgb(223, 244, 229)");
  const computed = await header.evaluate(node => ({ background: getComputedStyle(node).backgroundColor, token: getComputedStyle(node).getPropertyValue("--menro-forest").trim(), path: location.pathname }));
  await test.info().attach(`${role}-dashboard-computed`, { body: JSON.stringify(computed), contentType: "application/json" });
  await page.screenshot({ path: test.info().outputPath(`${role}-dashboard-desktop.png`) });
  await page.reload(); await expect(page.locator(".dashboard-kpi-grid")).toBeVisible();
  await expect(header).toHaveCSS("background-color", "rgb(20, 91, 58)");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(header).toHaveCSS("background-color", "rgb(20, 91, 58)");
  await page.screenshot({ path: test.info().outputPath(`${role}-dashboard-mobile.png`) });
  state.check();
});

test("closed sidebar is inert and opening, Escape, close and navigation restore safe focus", async ({ page }) => {
  const state = await fixture(page); await page.goto("/staff/requests?role=staff");
  const sidebar = page.locator("aside.sidebar"), trigger = page.getByRole("button", { name: "Open sidebar" });
  await expect(sidebar).toHaveJSProperty("inert", true);
  await trigger.click(); await expect(sidebar.getByRole("button", { name: "Close sidebar" })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); expect(await sidebar.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  await sidebar.locator("a").first().evaluate(node => node.focus()); await expect(trigger).toBeFocused();
  await trigger.click(); await sidebar.getByRole("button", { name: "Close sidebar" }).click(); await expect(trigger).toBeFocused();
  await trigger.click(); await sidebar.getByRole("link", { name: "Seedling Requests", exact: true }).click();
  await expect(trigger).toBeFocused(); await expect(sidebar).toHaveJSProperty("inert", true);
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('[aria-hidden="true"],[inert]')))).toBe(false);
  state.check();
});

test("sidebar navigation never leaves focused descendants inside aria-hidden content", async ({ page }) => {
  const state = await fixture(page); await page.goto("/staff/requests?role=staff");
  await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.locator("aside.sidebar").getByRole("link", { name: "Seedling Requests", exact: true }).click();
  await page.locator("main").ariaSnapshot();
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('[aria-hidden="true"],[inert]')))).toBe(false);
  state.check();
});

test("release inventory loading settles, busy release cannot double-submit or dismiss, and success restores safe focus", async ({ page }) => {
  let finishInventory, finishRelease, released = false, releaseBody;
  const state = await fixture(page, {
    "GET /api/inventory": route => new Promise(resolve => { finishInventory = async () => { await route.fulfill({ json: { success: true, data: [{ id: "narra", availableQuantity: 100 }] } }); resolve(); }; }),
    "GET /api/seedling-requests": route => route.fulfill({ json: { success: true, data: [{ ...request, status: released ? "Released" : "Approved" }] } }),
    "PATCH /api/seedling-requests/release-fixture/release": (route, req) => new Promise(resolve => {
      releaseBody = req.postDataJSON(); finishRelease = async () => { released = true; await route.fulfill({ json: { success: true, data: { ...request, status: "Released" } } }); resolve(); };
    }),
  });
  const { dialog } = await openRelease(page);
  await expect(dialog.getByText("Loading current inventory...")).toBeVisible(); await expect(dialog.getByRole("button", { name: "Confirm Release" })).toBeDisabled();
  await expect.poll(() => Boolean(finishInventory)).toBe(true); await finishInventory();
  await expect(dialog.getByText("Loading current inventory...")).toHaveCount(0);
  await dialog.getByLabel("Available Release Date").fill("2026-11-05"); await dialog.getByLabel("Actual Released Quantity *").fill("10");
  await dialog.getByRole("button", { name: "Confirm Release" }).click(); await expect(dialog.getByRole("button", { name: "Releasing..." })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled(); await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  expect(state.calls.filter(key => key.startsWith("PATCH"))).toHaveLength(1);
  await expect.poll(() => Boolean(finishRelease)).toBe(true); await finishRelease(); await expect(dialog).not.toBeVisible();
  expect(releaseBody).toEqual({ items: [{ inventoryId: "narra", releasedQuantity: 10, shortReleaseReason: "" }], availableReleaseDate: "2026-11-05", expectedVersion: 4 });
  await expect(page.getByText("REQ-2026-001 was released successfully.", { exact: true })).toBeVisible();
  await expect(page.locator(".sr-detail-footer-actions").getByRole("button", { name: "Close", exact: true })).toBeFocused(); state.check();
});

test("failed inventory loading resolves to an accessible error and safe close", async ({ page }) => {
  const state = await fixture(page, { "GET /api/inventory": route => route.fulfill({ status: 503, json: { success: false, message: "Stock unavailable" } }) });
  const { dialog, trigger } = await openRelease(page);
  await expect(dialog.getByRole("alert")).toContainText("Unable to load current stock");
  await expect(dialog.getByText("Loading current inventory...")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Confirm Release" })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused(); state.check();
});

test("failed release clears busy state and preserves quantities, version and focus containment", async ({ page }) => {
  const state = await fixture(page, { "PATCH /api/seedling-requests/release-fixture/release": route => route.fulfill({ status: 409, json: { success: false, message: "Request version changed. Refresh before release." } }) });
  const { dialog, trigger } = await openRelease(page);
  await dialog.getByLabel("Available Release Date").fill("2026-11-05"); await dialog.getByLabel("Actual Released Quantity *").fill("10");
  await dialog.getByRole("button", { name: "Confirm Release" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Request version changed");
  await expect(dialog.getByRole("button", { name: "Confirm Release" })).toBeEnabled(); await expect(dialog.getByLabel("Actual Released Quantity *")).toHaveValue("10");
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused(); state.check();
});

function contrast(a, b) {
  const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
  const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
for (const role of ["admin", "staff", "participant"]) test(`${role} forest topbar maintains contrast, desktop/mobile layout and search/notification/profile interactions`, async ({ page }) => {
  const state = await fixture(page); const path = role === "participant" ? "my-requests" : "requests";
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto(`/${role}/${path}?role=${role}`);
  const header = page.locator("header.topbar"); await expect(header).toHaveCSS("background-color", "rgb(20, 91, 58)"); await expect(header).toHaveCSS("position", "sticky");
  const colors = await header.evaluate(node => {
    const css = selector => getComputedStyle(node.querySelector(selector)), background = getComputedStyle(node).backgroundColor;
    return [ ...[".topbar-menu-btn", ".topbar-icon-btn", ".topbar-user-name", ".topbar-user-role", ".topbar-profile-chevron"].map(selector => [css(selector).color, background]),
      [css(".topbar-search input").color, css(".topbar-search input").backgroundColor],
      [getComputedStyle(node.querySelector("input"), "::placeholder").color, css(".topbar-search input").backgroundColor],
      [css(".topbar-search-icon").color, css(".topbar-search input").backgroundColor], [css(".topbar-avatar").color, css(".topbar-avatar").backgroundColor] ];
  });
  const ratios = colors.map(([foreground, background]) => contrast(foreground, background));
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  await test.info().attach(`${role}-contrast`, { body: JSON.stringify({ ratios, minimum: Math.min(...ratios) }), contentType: "application/json" });
  const menu = page.getByRole("button", { name: "Open sidebar" }); await menu.focus(); await expect(menu).toHaveCSS("outline-style", "solid");
  const bell = page.getByRole("button", { name: "Notifications", exact: true }); await bell.click(); await expect(page.locator(".notification-panel")).toBeVisible();
  const badge = page.locator(".notification-badge"); await expect(badge).toHaveText("2");
  const badgeColors = await badge.evaluate(node => [getComputedStyle(node).color, getComputedStyle(node).backgroundColor]); expect(contrast(...badgeColors)).toBeGreaterThanOrEqual(4.5);
  await page.getByRole("tab", { name: "Unread", exact: true }).click(); await page.locator(".notification-panel").getByRole("button", { name: "Close", exact: true }).click();
  await page.locator(".topbar-user").click(); await expect(page.getByRole("menuitem", { name: "Profile", exact: true })).toBeVisible(); await page.locator(".topbar-user").click();
  const search = page.getByRole("searchbox", { name: "Search system" }); await search.fill("Fixture"); await expect(page.getByRole("listbox").getByRole("option")).toContainText("Fixture request");
  await search.press("Escape"); await expect(page.getByRole("listbox")).not.toBeVisible();
  await search.fill("Fixture"); await expect(page.getByRole("listbox").getByRole("option")).toBeVisible(); await page.getByRole("button", { name: "Clear search" }).click(); await expect(search).toHaveValue("");
  await page.setViewportSize({ width: 375, height: 812 }); await expect(header).toBeVisible(); await expect(search).toBeVisible();
  await page.screenshot({ path: test.info().outputPath(`${role}-mobile.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = await search.boundingBox(); expect(box.width).toBeGreaterThan(50);
  await menu.click(); await expect(page.getByRole("button", { name: "Close sidebar" })).toBeFocused(); await page.keyboard.press("Escape"); await expect(menu).toBeFocused();
  state.check();
});
