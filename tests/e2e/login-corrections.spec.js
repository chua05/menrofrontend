import { expect, test } from "@playwright/test";
for (const role of ["admin", "staff", "participant"]) for (const method of ["email", "google"]) {
  test(`${role} ${method}: fresh login ignores old route, shows one fixed toast and preserves authenticated deep links`, async ({ page }) => {
    const unexpected = [];
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== "http://127.0.0.1:5184") { unexpected.push(url.origin); return route.abort(); }
      if (!url.pathname.startsWith("/api/")) return route.continue();
      let data;
      if (url.pathname === "/api/auth/profile") data = { uid: `test-${role}`, fullName: "Login fixture", role, profileComplete: true };
      else if (url.pathname === "/api/notifications/unread-count") data = { unreadCount: 0 };
      else if (["/api/notifications", "/api/seedling-requests", "/api/seedling-requests/my", "/api/seedling-requests/my-requests", "/api/planting-reports", "/api/planting-reports/my-reports", "/api/events", "/api/monitoring", "/api/monitoring/my-records", "/api/distributions", "/api/distributions/my-distributions", "/api/users", "/api/inventory", "/api/sites"].includes(url.pathname)) data = [];
      else { unexpected.push(url.pathname); return route.fulfill({ status: 500, json: { success: false, message: "Unregistered fixture" } }); }
      return route.fulfill({ json: { success: true, data } });
    });
    await page.addInitScript(role => sessionStorage.setItem("fixture-login-role", role), role);
    const deep = `/${role}/${role === "participant" ? "my-planting-reports" : "planting-reports"}`;
    await page.goto(deep); await expect(page).toHaveURL(/\/login$/);
    if (method === "email") {
      await page.locator("#login-email").fill("fixture@example.test"); await page.locator("#login-password").fill("fixture-password");
      await page.locator("button.login-primary-btn").click();
    } else await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`));
    await expect(page.getByText("Login Successful", { exact: true })).toHaveCount(1);
    await expect(page.locator(".menro-toast-viewport-floating")).toHaveCSS("position", "fixed");
    const topbarBefore = await page.locator(".topbar").boundingBox();
    await expect(page.getByText("Login Successful", { exact: true })).toHaveCount(0, { timeout: 6000 });
    expect(await page.locator(".topbar").boundingBox()).toEqual(topbarBefore);
    await page.goto(deep); await expect(page).toHaveURL(new RegExp(`${deep}$`));
    await page.reload(); await expect(page).toHaveURL(new RegExp(`${deep}$`));
    await expect(page.getByText("Login Successful", { exact: true })).toHaveCount(0);
    await page.locator(".topbar-user").click(); await page.getByRole("menuitem", { name: "Logout", exact: true }).click();
    await page.getByRole("button", { name: "Log out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => sessionStorage.getItem("menro:pending-dashboard-login"))).toBeNull();
    if (method === "email") {
      await page.locator("#login-email").fill("fixture@example.test"); await page.locator("#login-password").fill("fixture-password");
      await page.locator("button.login-primary-btn").click();
    } else await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`));
    await expect(page.getByText("Login Successful", { exact: true })).toHaveCount(1);
    expect(unexpected).toEqual([]);
  });
}

for (const route of ["/login", "/register", "/staff/dashboard"]) test("pending auth stays visible and fail-closed at " + route, async ({ page }) => {
  const external = [];
  await page.route("**/*", request => { const url = new URL(request.request().url()); if (url.origin !== "http://127.0.0.1:5184") { external.push(url.origin); return request.abort(); } if (url.pathname.startsWith("/api/")) return request.fulfill({ json: { success: true, data: [] } }); return request.continue(); });
  await page.addInitScript(() => sessionStorage.setItem("fixture-auth-loading", "true"));
  await page.goto(route);
  await expect(page.getByRole("heading", { name: "Checking your sign-in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reload page" })).toBeVisible();
  await expect(page.locator("#login-email")).toHaveCount(0);
  await expect(page.locator(".dashboard-kpi-grid")).toHaveCount(0);
  expect(external).toEqual([]);
});
