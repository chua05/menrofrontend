import { expect, test } from "@playwright/test";

const ADMIN_PAGES = ["Home", "Seedling Requests", "Seedling Inventory", "Event Calendar", "Planting Sites", "Planting Reports",
  "Survival Monitoring", "Analytics and Visualization", "Map Visualization", "Reports", "Registered Users", "Settings"];

async function mockApi(page) {
  const unexpected = [];
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:5184") { unexpected.push(url.origin); return route.abort(); }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/notifications/unread-count") return route.fulfill({ json: { success: true, data: { unreadCount: 0 } } });
    if (url.pathname === "/api/notifications") return route.fulfill({ json: { success: true, data: { notifications: [], unreadCount: 0, hasMore: false, nextCursor: null } } });
    if (url.pathname === "/api/analytics/dashboard") return route.fulfill({ json: { success: true, data: {
      summary: {}, distributionTrend: [], plantingTrend: [], survivalTrend: [], monitoringConditions: [], speciesDistribution: [],
      barangaySurvival: [], siteMap: [], permanentSample: null, options: { barangays: [], species: [], sites: [] }, meta: {} } } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  return { check: () => expect(unexpected).toEqual([]) };
}

const edges = page => page.evaluate(() => ({
  sidebarRight: document.querySelector("#menro-sidebar").getBoundingClientRect().right,
  sidebarWidth: document.querySelector("#menro-sidebar").getBoundingClientRect().width,
  mainLeft: document.querySelector(".dashboard-main").getBoundingClientRect().left,
  mainRight: document.querySelector(".dashboard-main").getBoundingClientRect().right,
  topbarLeft: document.querySelector(".topbar").getBoundingClientRect().left,
}));

async function expectSettled(page, width) {
  await expect.poll(async () => {
    const box = await edges(page);
    return Math.abs(box.sidebarWidth - width) < 0.5 && Math.abs(box.mainLeft - box.sidebarRight) < 0.5;
  }).toBe(true);
}

test("admin docked sidebar pushes the page, collapses to an icon rail with tooltips and remembers the choice", async ({ page }) => {
  const api = await mockApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/requests?role=admin");
  const sidebar = page.locator("aside#menro-sidebar");
  const toggle = page.locator(".topbar-menu-btn");

  // Expanded by default at >= 1280px: a normal landmark, never modal, and the page starts at its right edge.
  await expect(sidebar).toHaveClass(/expanded/);
  await expect(toggle).toHaveAccessibleName("Collapse sidebar");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAttribute("aria-controls", "menro-sidebar");
  await expect(sidebar).toHaveJSProperty("inert", false);
  await expect(sidebar).not.toHaveAttribute("aria-hidden", /.*/);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: "Close sidebar" })).toHaveCount(0);
  await expectSettled(page, 248);
  const box = await edges(page);
  expect(box.topbarLeft).toBeCloseTo(box.sidebarRight, 0);
  expect(box.mainRight).toBeCloseTo(1440, 0);
  const expandedNames = await sidebar.getByRole("navigation", { name: "Main navigation" }).getByRole("link").allInnerTexts();
  for (const name of ADMIN_PAGES) expect(expandedNames).toContain(name);

  // Collapse: 72px rail, the page follows it, and one resize event tells maps and charts to re-measure.
  await page.evaluate(() => { window.__resizes = 0; window.addEventListener("resize", () => { window.__resizes += 1; }); });
  await toggle.click();
  await expect(sidebar).toHaveClass(/rail/);
  await expect(toggle).toHaveAccessibleName("Expand sidebar");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expectSettled(page, 72);
  await expect.poll(() => page.evaluate(() => window.__resizes)).toBe(1);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__resizes)).toBe(1);

  // Every nav item of the role is an icon link in the rail, named by its page; section headings are gone.
  const rail = sidebar.getByRole("navigation", { name: "Main navigation" });
  await expect(rail.locator(".sb-section")).toHaveCount(0);
  await expect(rail.getByRole("link")).toHaveCount(expandedNames.length);
  for (const name of expandedNames) await expect(rail.getByRole("link", { name, exact: true })).toBeVisible();

  // Hover and keyboard focus show the page name beside the icon, outside the scrolling nav.
  const inventory = rail.getByRole("link", { name: "Seedling Inventory", exact: true });
  await inventory.hover();
  const tooltip = page.locator(".sb-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText("Seedling Inventory");
  const [iconBox, tipBox] = [await inventory.boundingBox(), await tooltip.boundingBox()];
  expect(tipBox.x).toBeGreaterThan(iconBox.x + iconBox.width);
  await page.mouse.move(800, 600);
  await expect(tooltip).toHaveCount(0);
  await page.keyboard.press("Shift"); // keyboard modality, so :focus-visible matches
  await rail.getByRole("link", { name: "Settings", exact: true }).focus();
  await expect(tooltip).toHaveText("Settings");
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);

  // A rail unread badge sits on the icon and keeps its label.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("menro:notifications-updated", {
    detail: { notifications: [{ id: "n1", isRead: false, type: "inventory_low_stock", relatedRecordType: "inventory" }] } })));
  const badge = inventory.locator(".sb-item-badge");
  await expect(badge).toHaveText("1");
  await expect(badge).toHaveAttribute("aria-label", "1 unread update");
  await expect(badge).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(badge).toHaveCSS("color", "rgb(22, 101, 52)");
  await expect(inventory).toHaveAccessibleDescription("1 unread update");

  // Navigating from the rail keeps it collapsed.
  await inventory.click();
  await expect(page).toHaveURL(/\/admin\/seedlings/);
  await expect(sidebar).toHaveClass(/rail/);

  // The choice persists across a reload (back on a page without a first-visit guide); expanding again shows no tooltips.
  await page.goto("/admin/requests?role=admin");
  await expect(sidebar).toHaveClass(/rail/);
  await expectSettled(page, 72);
  await toggle.click();
  await expectSettled(page, 248);
  await sidebar.getByRole("link", { name: "Settings", exact: true }).hover();
  await expect(page.locator(".sb-tooltip")).toHaveCount(0);
  await page.reload();
  await expect(sidebar).toHaveClass(/expanded/);
  api.check();
});

test("tablet width defaults to the rail and phone width uses the overlay drawer", async ({ page }) => {
  const api = await mockApi(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/admin/requests?role=admin");
  const sidebar = page.locator("aside#menro-sidebar");
  await expect(sidebar).toHaveClass(/rail/);
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await expectSettled(page, 72);

  // Reduced motion: no width/margin transition, and still exactly one resize after the change.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".dashboard-main")).toHaveCSS("transition-property", "none");
  await page.evaluate(() => { window.__resizes = 0; window.addEventListener("resize", () => { window.__resizes += 1; }); });
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(() => page.evaluate(() => window.__resizes)).toBe(1);
  await expectSettled(page, 248);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expectSettled(page, 72);

  await page.setViewportSize({ width: 390, height: 844 });
  const open = page.getByRole("button", { name: "Open sidebar" });
  await expect(open).toHaveAttribute("aria-expanded", "false");
  const drawer = page.locator("dialog#menro-sidebar aside.sidebar");
  await expect(drawer).toHaveJSProperty("inert", true);
  expect((await page.locator(".dashboard-main").boundingBox()).x).toBe(0);
  await open.click();
  await expect(page.locator("dialog#menro-sidebar")).toHaveJSProperty("open", true);
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await expect(drawer.getByRole("button", { name: "Close sidebar" })).toBeFocused();
  await expect(drawer.locator(".sb-section").first()).toHaveText("Home");
  await expect(drawer.getByRole("link", { name: "Seedling Inventory", exact: true })).toBeVisible();

  // Widening past the breakpoint with the drawer open closes it and docks the sidebar.
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator("aside#menro-sidebar")).toHaveClass(/docked/);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  const home = page.locator("aside#menro-sidebar").getByRole("link", { name: "Home", exact: true });
  await home.click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  api.check();
});

test("rail tooltip is gone after a click navigation", async ({ page }) => {
  const api = await mockApi(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/admin/requests?role=admin");
  await expect(page.locator("aside#menro-sidebar")).toHaveClass(/rail/);
  const rail = page.locator("aside#menro-sidebar").getByRole("navigation", { name: "Main navigation" });
  await rail.getByRole("link", { name: "Seedling Inventory", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/seedlings/);
  await page.waitForTimeout(300);
  await expect(page.locator(".sb-tooltip")).toHaveCount(0);
  api.check();
});

test("a touch tap on a rail link leaves no tooltip behind", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();
  const api = await mockApi(page);
  await page.goto("http://127.0.0.1:5184/admin/requests?role=admin");
  await expect(page.locator("aside#menro-sidebar")).toHaveClass(/rail/);
  await page.locator("aside#menro-sidebar").getByRole("link", { name: "Seedling Inventory", exact: true }).tap();
  await expect(page).toHaveURL(/\/admin\/seedlings/);
  await page.waitForTimeout(300);
  await expect(page.locator(".sb-tooltip")).toHaveCount(0);
  api.check();
  await context.close();
});

test("keyboard Tab focus and mouse hover still show the rail tooltip", async ({ page }) => {
  const api = await mockApi(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/admin/requests?role=admin");
  const rail = page.locator("aside#menro-sidebar").getByRole("navigation", { name: "Main navigation" });
  const links = rail.getByRole("link");
  await links.first().focus();
  await page.keyboard.press("Tab");
  await expect(links.nth(1)).toBeFocused();
  await expect(page.locator(".sb-tooltip")).toBeVisible();
  await rail.getByRole("link", { name: "Settings", exact: true }).hover();
  await expect(page.locator(".sb-tooltip")).toHaveText("Settings");
  api.check();
});

test("without a stored choice the default follows the 1280px breakpoint until the user toggles", async ({ page }) => {
  const api = await mockApi(page);
  const sidebar = page.locator("aside#menro-sidebar");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/requests?role=admin");
  await expect(sidebar).toHaveClass(/expanded/);
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(sidebar).toHaveClass(/rail/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(sidebar).toHaveClass(/expanded/);

  await page.locator(".topbar-menu-btn").click();
  await expect(sidebar).toHaveClass(/rail/);
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await expect(sidebar).toHaveClass(/rail/);
  api.check();
});
