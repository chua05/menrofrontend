import { test, expect } from "@playwright/test";

const PASSWORD = "Phase2-Test-Only!2026";
const email = (role) => `phase2.${role}@example.test`;

async function login(page, role) {
  await page.goto("/login");
  await page.locator("#login-email").fill(email(role));
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator("button.login-primary-btn").click();
  await expect(page).toHaveURL(new RegExp(`/${role}/`), { timeout: 30_000 });
}

async function verifyBoundaryMap(page, route, { requireSiteMarker = false } = {}) {
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/sites/barangay-boundaries") && response.request().method() === "GET"
  );
  await page.goto(route);
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-cache, must-revalidate");
  const body = await response.json();
  expect(body.features).toHaveLength(63);
  expect(body.metadata).toMatchObject({
    datasetId: "mpdo-bulan",
    datasetVersion: "brgy_bound_WGS84_Bulan",
    status: "selected_reference",
    featureCount: 63,
    municipalContainmentPolicy: "selected-or-current-compatibility-v1",
  });
  expect(new Set(body.features.map((feature) => feature.properties.brgy_name)).size).toBe(63);
  expect(new Set(body.features.map((feature) => feature.properties.mpdo_name)).size).toBe(63);
  await expect(page.locator(".leaflet-menroBarangayBoundaries-pane path")).toHaveCount(63, { timeout: 30_000 });
  await expect(page.locator(".leaflet-container").first()).toBeVisible();
  if (requireSiteMarker) {
    const markers = page.locator(".leaflet-marker-pane .leaflet-marker-icon, .leaflet-overlay-pane .leaflet-interactive");
    expect(await markers.count()).toBeGreaterThan(0);
  }
}

for (const role of ["participant", "staff", "admin"]) {
  test(`${role} renders candidate boundaries and synthetic site markers`, async ({ page }) => {
    await login(page, role);
    if (role !== "participant") {
      await verifyBoundaryMap(page, `/${role}/dashboard`);
    }
    await verifyBoundaryMap(page, `/${role}/planting-sites`, { requireSiteMarker: true });
  });
}

for (const role of ["staff", "admin"]) {
  test(`${role} renders candidate operational and analytics maps`, async ({ page }) => {
    await login(page, role);
    await verifyBoundaryMap(page, `/${role}/map-visualization`, { requireSiteMarker: true });
    await verifyBoundaryMap(page, `/${role}/reforestation-analytics`, { requireSiteMarker: true });
  });
}
