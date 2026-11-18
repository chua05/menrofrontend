import { expect, test } from "@playwright/test";

const monitoringLabel = "Permanent Sample Monitoring";

async function isolate(page, gateEnabled = true) {
  await page.addInitScript((enabled) => {
    window.__PHASE3C_GATE_ENABLED__ = enabled ? "true" : "false";
  }, gateEnabled);
  await page.route(/^(?!http:\/\/127\.0\.0\.1:5184).*/, (route) => route.abort());
}

async function expectMonitoringPage(page) {
  await expect(page.getByRole("heading", { name: monitoringLabel })).toBeVisible();
}

async function mockLegacyMonitoringApi(page, { monitoring = [], plantingReports = null } = {}) {
  await page.route("http://localhost:5000/api/**", (route) => {
    const url = new URL(route.request().url());
    const data = ["/api/monitoring", "/api/monitoring/my-records"].includes(url.pathname) ? monitoring
      : plantingReports && ["/api/planting-reports", "/api/planting-reports/my-reports"].includes(url.pathname) ? plantingReports
      : url.pathname === "/api/planting-reports" ? [{
        id: "phase3c-staff-report",
        reportNumber: "TEST-STAFF-MONITORING",
        verificationStatus: "Approved",
        reportingProgress: "Completed",
        participantId: "requester-fixture",
        participantName: "Requester Fixture",
        siteId: "site-fixture",
        siteName: "Bulan Test Site",
        barangay: "Bulan",
        species: "Narra",
        quantityPlanted: 10,
        plantingDate: "2026-10-01",
      }]
        : url.pathname === "/api/sites" ? [] : null;
    if (!data) return route.abort();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });
}

test("same permanent tree in different visits never reuses cached private photos", async ({ page }) => {
  await isolate(page);
  await page.addInitScript(() => {
    window.__REVOKED_PHOTOS__ = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = value => { window.__REVOKED_PHOTOS__.push(value); revoke(value); };
  });
  await page.goto("/admin/permanent-sample-monitoring?role=admin&fixture=two-visits");
  await page.getByRole("button", { name: "VPMV-RETURNED-001", exact: true }).click();
  await page.getByRole("button", { name: "View private evidence revision 0", exact: true }).click();
  const image = page.getByAltText("Private evidence for TREE-001, revision 0");
  await expect(image).toBeVisible(); const first = await image.getAttribute("src");
  await page.getByLabel("Verified Planting Report").selectOption("VPMV-APPROVED-001");
  await expect(image).toHaveCount(0);
  expect(await page.evaluate(value => window.__REVOKED_PHOTOS__.includes(value), first)).toBe(true);
  await page.getByRole("button", { name: "View private evidence revision 0", exact: true }).click();
  await expect(image).toBeVisible(); expect(await image.getAttribute("src")).not.toBe(first);
  expect(await page.evaluate(() => window.__PHASE3C_REQUESTS__.at(-1))).toBe("/evidence/sample-monitoring/visits/VPMV-APPROVED-001/samples/TREE-001/evidence/0");
});

test("admin deep-link review route still works but has no sidebar item", async ({ page }) => {
  await isolate(page);
  await page.goto("/admin/permanent-sample-monitoring?role=admin");
  await expectMonitoringPage(page);
  await expect(
    page.getByRole("link", { name: monitoringLabel, exact: true, includeHidden: true })
  ).toHaveCount(0);
});

test("replaced and cross-visit pending photo previews are revoked", async ({ page }) => {
  await isolate(page);
  await page.addInitScript(() => {
    window.__REVOKED_PENDING__ = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = value => { window.__REVOKED_PENDING__.push(value); revoke(value); };
  });
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=two-visits");
  await page.getByRole("button", { name: "VPMV-RETURNED-001", exact: true }).click();
  const preview = page.getByAltText("Verified evidence preview for TREE-001");
  let first;
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Capture verified photo for TREE-001" }).click();
    await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
    await expect(page.getByRole("dialog", { name: "Secure camera capture" })).toHaveCount(0);
    await expect(preview).toBeVisible();
    if (i === 0) first = await preview.getAttribute("src");
  }
  expect(await page.evaluate(value => window.__REVOKED_PENDING__.includes(value), first)).toBe(true);
  const second = await preview.getAttribute("src");
  page.once("dialog", dialog => dialog.accept()); // Explicitly discard this test-owned pending photo.
  await page.getByLabel("Verified Planting Report").selectOption("VPMV-APPROVED-001");
  await expect(preview).toHaveCount(0);
  expect(await page.evaluate(value => window.__REVOKED_PENDING__.includes(value), second)).toBe(true);
  await expect(page.getByRole("button", { name: "Upload verified photo for TREE-001" })).toHaveCount(0);
});

test("staff route still renders for deep links but Staff have no Permanent Sample Monitoring sidebar entry", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff");
  await expectMonitoringPage(page);
  await expect(page.getByRole("link", { name: monitoringLabel, exact: true, includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Survival Monitoring", exact: true, includeHidden: true })).toHaveCount(1);
});

test("participant is denied both protected monitoring routes", async ({ page }) => {
  await isolate(page);
  for (const path of [
    "/admin/permanent-sample-monitoring?role=participant",
    "/staff/permanent-sample-monitoring?role=participant",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/participant\/dashboard/);
    await expect(page.getByRole("heading", { name: monitoringLabel })).toHaveCount(0);
  }
});

test("participant legacy monitoring links redirect to planting reports without submission tasks", async ({ page }) => {
  await isolate(page);
  await page.goto("/participant/survival-monitoring?role=participant");
  await expect(page).toHaveURL(/\/participant\/my-planting-reports/);
  await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toHaveCount(0);
  await page.goto("/participant/dashboard?role=participant");
  await page.getByRole("button", { name: "Open sidebar" }).click();
  await expect(page.getByRole("link", { name: "Survival Monitoring", includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "My Planting Reports" })).toBeVisible();
});

const aggregateLabel = "Monitor Planted Trees";
const primaryLabel = "Submit Monitoring Record";
const sampleTreeLabel = "Monitor Permanent Sample Trees";
const blueprintSections = ["1. Verified Planting Site Information", "2. Monitoring Summary & Automatic Schedule", "3. Assessment Progress",
  "4. Permanent Sample Tree Records", "5. Individual Tree Assessment", "7. Automatic Monitoring Visit Summary"];

const staffSubmissionControls = page => page.locator(".sm-header-actions").locator("button, a").filter({ hasText: /Submit|Monitor/ });
async function openStaffMonitoring(page, fixture = "", role = "staff") {
  await page.goto(`/${role}/survival-monitoring?role=${role}${fixture ? `&fixture=${fixture}` : ""}`);
  await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
  await expect(staffSubmissionControls(page)).toHaveCount(1);
  const button = page.locator(".sm-header-actions").getByRole("button", { name: aggregateLabel, exact: true });
  await expect(button).toHaveClass(/sm-primary-button/);
  await button.click();
  await expect(page).toHaveURL(new RegExp(`/${role}/survival-monitoring`));
  await expect(page.locator(".sm-modal")).toHaveCount(0);
  const dialog = page.getByRole("dialog", { name: "Monitor Planted Trees" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("Staff page shows one submission button, no baselines panel and no separate permanent-sample entry points", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page);
  await page.goto("/staff/survival-monitoring?role=staff");
  await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
  await expect(staffSubmissionControls(page)).toHaveCount(1);
  await expect(page.getByRole("button", { name: aggregateLabel, exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: primaryLabel, exact: true, includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: primaryLabel, exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Permanent Sample Selection and Baselines" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: monitoringLabel, exact: true, includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Survival Monitoring", exact: true, includeHidden: true })).toHaveCount(1);
});

test("the single Staff button opens the seven-section permanent-sample form in Monitor Planted Trees, not the legacy aggregate form", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page);
  const dialog = await openStaffMonitoring(page);
  // The default fixture's list has more pages, so Staff chooses a visit inside the modal instead of a guessed auto-open.
  await expect(dialog.getByRole("status").filter({ hasText: "Select the monitoring visit to continue." })).toBeVisible();
  await dialog.locator(".psm-visit-choice").first().click();
  await expect(dialog.getByText("Monitor registered sample trees and document their current survival conditions.", { exact: true })).toBeVisible();
  for (const heading of blueprintSections) await expect(dialog.getByRole("heading", { name: heading })).toBeVisible();
  for (const legacy of ["Total Trees Checked", "Maturity Status", "Healthy *", "Damaged *", "Dead *"]) await expect(dialog.getByLabel(legacy, { exact: true })).toHaveCount(0);
  await expect(dialog.locator(".psm-progress-card")).toHaveCount(3);
  await expect(dialog.locator(".psm-tree-list button")).toHaveCount(2);
  await expect(dialog.locator(".psm-location .leaflet-container")).toBeVisible();
  await dialog.getByRole("radio", { name: "Needs Rechecking", exact: true }).check();
  await expect(dialog.getByRole("heading", { name: "6. Rechecking & Requester Clarification" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save Draft", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Submit Visit", exact: true })).toHaveText("Submit Monitoring Visit");
  // Closing keeps the unsaved per-tree edit; reopening shows the same visit.
  await dialog.getByRole("button", { name: "Close monitoring visit" }).click();
  await expect(dialog).toHaveCount(0);
  await page.locator(".sm-header-actions").getByRole("button", { name: aggregateLabel, exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Monitor Planted Trees" }).getByRole("radio", { name: "Needs Rechecking", exact: true })).toBeChecked();
  await expect(page.locator(".sm-modal")).toHaveCount(0);
});

test("one authorized editable visit opens directly inside the Staff modal", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page);
  const dialog = await openStaffMonitoring(page, "returned");
  await expect(dialog.getByRole("combobox", { name: "Verified Planting Report", exact: true })).toHaveValue("VPMV-RETURNED-001");
  await expect(dialog.locator(".psm-status-badge")).toHaveText("Returned for Correction");
  await expect(dialog.getByRole("radiogroup", { name: "Tree Condition *" })).toBeVisible();
});

test("zero authorized visits show the backend blockers inside the Staff modal and never the legacy form", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page);
  const dialog = await openStaffMonitoring(page, "empty");
  await expect(dialog.getByRole("status").filter({ hasText: "No authorized monitoring visits are available." })).toBeVisible();
  await expect(dialog.getByRole("region", { name: "Why no monitoring visit is available" })).toBeVisible();
  await expect(dialog.getByText("New monitoring visits can start only after MENRO approves the visit scheduling policy.", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Back to Survival Monitoring" })).toHaveCount(0);
  await expect(dialog.getByLabel("Total Trees Checked", { exact: true })).toHaveCount(0);
});

test("zero authorized visits still render the seven-section form shell read-only with truthful empty values", async ({ page }) => {
  await isolate(page);
  // No verified planting report either, so nothing is selectable (Setup Pending is covered separately).
  await mockLegacyMonitoringApi(page, { plantingReports: [] });
  const writes = [];
  page.on("request", request => { if (request.method() !== "GET" && request.url().includes("/api/verified-sample-monitoring")) writes.push(request.url()); });
  const dialog = await openStaffMonitoring(page, "empty");
  for (const heading of ["1. Verified Planting Site Information", "2. Monitoring Summary & Automatic Schedule", "3. Assessment Progress",
    "4. Permanent Sample Tree Records", "5. Individual Tree Assessment", "6. Rechecking & Requester Clarification", "7. Automatic Monitoring Visit Summary"])
    await expect(dialog.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(dialog.locator(".psm-shell").getByText("No authorized visit selected", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText("Pending Official Schedule", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText(/No registered Tree IDs are available/)).toBeVisible();
  await expect(dialog.locator(".psm-shell").getByText(/^Approved$/)).toHaveCount(0);
  await expect(dialog.getByRole("combobox", { name: "Verified Planting Report", exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("Date Monitored *", { exact: true })).toBeDisabled();
  for (const name of ["Take Photo", "Upload Existing Photo", "Verify Photo Location", "Save Draft", "Submit Visit"])
    await expect(dialog.getByRole("button", { name, exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("Height (cm)", { exact: true })).toBeDisabled();
  await expect(dialog.getByRole("radio", { name: "Healthy" })).toBeDisabled();
  await expect(dialog.getByRole("checkbox", { name: /Request additional information/ })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Submit Visit", exact: true })).toHaveText("Submit Monitoring Visit");
  await expect(dialog.getByText(/unavailable until MENRO creates an authorized monitoring visit/)).toBeVisible();
  expect(writes).toEqual([]);
});

for (const fixture of ["index-missing-raw", "index-missing"])
test(`Admin review route never shows the raw Firestore index error (${fixture}) and does not overflow`, async ({ page }) => {
  await isolate(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`/admin/permanent-sample-monitoring?role=admin&fixture=${fixture}`);
  await expect(page.getByRole("alert").first()).toHaveText(/required database index is not ready/);
  await expect(page.locator("body")).not.toContainText(/FAILED_PRECONDITION|console\.firebase|create_composite/);
  await expect(page.getByRole("button", { name: /Save Draft|Submit Visit/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("a disabled backend gate is explained inside the Staff modal", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page);
  const dialog = await openStaffMonitoring(page, "server-disabled");
  await expect(dialog.getByRole("alert")).toHaveText("Permanent sample tree monitoring is not enabled on the MENRO server yet.");
  await expect(page.locator(".sm-modal")).toHaveCount(0);
});

test("Staff arrival opens the only editable authorized visit directly and keeps other query state", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=returned&start=1");
  const dialog = page.getByRole("dialog", { name: "Monitor Planted Trees" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Verified Planting Report", exact: true })).toHaveValue("VPMV-RETURNED-001");
  await expect(dialog.locator(".psm-status-badge")).toHaveText("Returned for Correction");
  // The dialog must stay open (no second list load closing it) and the first tree stays editable.
  await page.waitForTimeout(500);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radiogroup", { name: "Tree Condition *" })).toBeVisible();
  await expect(page).toHaveURL(/fixture=returned/);
});

test("without the Staff start request the visit list is shown and nothing opens automatically", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=returned");
  await expect(page.getByRole("button", { name: "VPMV-RETURNED-001", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Monitor Planted Trees" })).toHaveCount(0);
  await expect(page.getByText("Select the monitoring visit to continue.", { exact: true })).toHaveCount(0);
});

test("Admin arriving with a start request never auto-opens a Staff visit", async ({ page }) => {
  await isolate(page);
  await page.goto("/admin/permanent-sample-monitoring?role=admin&fixture=returned&start=1");
  await expect(page.getByRole("button", { name: "VPMV-RETURNED-001", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /Monitor Planted Trees|Review Monitoring Visit/ })).toHaveCount(0);
});

test("Admin page has no Monitor Planted Trees button, no baselines panel, no review link and no sidebar item", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page);
  await page.goto("/admin/survival-monitoring?role=admin");
  await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
  await expect(staffSubmissionControls(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: aggregateLabel })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Monitor Planted Trees" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Permanent Sample Selection and Baselines" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: sampleTreeLabel, includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: monitoringLabel, exact: true, includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Survival Monitoring", exact: true, includeHidden: true })).toHaveCount(1);
});

test("Admin Survival Monitoring never mounts the Staff monitoring modal and sends no monitoring writes", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page);
  const writes = [];
  page.on("request", request => { if (request.method() !== "GET" && /\/api\/(verified-sample-monitoring|monitoring|sample-monitoring-information)/.test(request.url())) writes.push(request.url()); });
  await page.goto("/admin/survival-monitoring?role=admin&fixture=empty");
  await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
  await expect(page.locator(".sm-header-actions").getByRole("button", { name: /Monitor|Submit/ })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: /Monitor Planted Trees|Review Monitoring Visit/ })).toHaveCount(0);
  await expect(page.locator(".psm-shell")).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("Staff keep the seven-section Monitor Planted Trees form", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page);
  const dialog = await openStaffMonitoring(page, "empty", "staff");
  expect(await dialog.locator(".psm-shell .psm-section > h3").allTextContents()).toHaveLength(7);
});

test("Admin review route opens the one visit awaiting review in the read-only seven-section form with review actions only", async ({ page }) => {
  await isolate(page);
  await page.goto("/admin/permanent-sample-monitoring?role=admin&fixture=review-pending");
  await page.getByRole("button", { name: "VPMV-PENDING-REVIEW-001", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review Monitoring Visit" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".psm-status-badge")).toHaveText("Pending Admin Review");
  for (const heading of blueprintSections) await expect(dialog.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(dialog.getByRole("radiogroup", { name: "Tree Condition *" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "Healthy" })).toBeDisabled();
  await expect(dialog.getByLabel("Date Monitored *", { exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: /Save .*Draft|Submit Visit|Take Photo|Capture verified photo|Upload verified photo/ })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Approve Visit", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Return for Correction", exact: true })).toBeEnabled();
});

test("disabled frontend gate: the single button explains unavailability in the modal and never opens the legacy form", async ({ page }) => {
  await isolate(page, false);
  await mockLegacyMonitoringApi(page);
  for (const role of ["staff", "admin"]) {
    await page.goto(`/${role}/survival-monitoring?role=${role}`);
    await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
    await expect(page.getByRole("link", { name: sampleTreeLabel, includeHidden: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Permanent Sample Selection and Baselines" })).toHaveCount(0);
  }
  const dialog = await openStaffMonitoring(page);
  await expect(dialog.getByRole("status")).toHaveText("Permanent sample tree monitoring is not enabled in this environment.");
});

test("primary destination reports when no authorized permanent-sample visit exists instead of opening another form", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=empty");
  await expect(page.getByRole("status").filter({ hasText: "No authorized monitoring visits are available." })).toBeVisible();
  await expect(page.getByText("A visit appears here after MENRO creates it from an approved sampling plan and baseline.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Survival Monitoring", exact: true })).toHaveAttribute("href", "/staff/survival-monitoring");
  await expect(page.locator(".sm-modal")).toHaveCount(0);
});

test("empty visit list explains each site's readiness blockers in plain language", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=empty");
  const panel = page.getByRole("region", { name: "Why no monitoring visit is available" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "PR-READY · Bical ready site" })).toBeVisible();
  await expect(panel.getByText("Another Staff member has an open visit for this site (Pending Admin Review).", { exact: true })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Planting report · Planting site" })).toBeVisible();
  await expect(panel.getByText("The MENRO sampling policy is incomplete: minimum sample size.", { exact: true })).toBeVisible();
  await expect(panel.getByText("The sampling plan is not approved yet (current status: Draft).", { exact: true })).toBeVisible();
  await expect(panel.getByText("New monitoring visits can start only after MENRO approves the visit scheduling policy.", { exact: true })).toHaveCount(2);
  await expect(panel).not.toContainText(/OPEN_VISIT|_PENDING|cohort-ready/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("readiness load failure keeps the empty-state explanation and never opens a form", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=empty-readiness-error");
  await expect(page.getByRole("status").filter({ hasText: "No authorized monitoring visits are available." })).toBeVisible();
  await expect(page.getByText("Visit readiness details could not be loaded. Refresh to try again.", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("readiness reports when no verified planting cohort exists yet", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=empty-no-cohorts");
  await expect(page.getByText("No verified planting reports are ready for permanent-sample monitoring yet.", { exact: true })).toBeVisible();
});

test("readiness is not requested when authorized visits exist", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff");
  await expect(page.getByRole("button", { name: "VPMV-STAFF-001", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Why no monitoring visit is available" })).toHaveCount(0);
  expect(await page.evaluate(() => window.__PHASE3C_READINESS_CALLS__ || 0)).toBe(0);
});

for (const viewport of [{ width: 1366, height: 800 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`survival monitoring header actions fit without overlap at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await isolate(page);
    await mockLegacyMonitoringApi(page);
    await page.goto("/staff/survival-monitoring?role=staff");
    const actions = page.locator(".sm-header-actions");
    const controls = [
      actions.getByTitle("Refresh data"),
      actions.getByRole("button", { name: aggregateLabel, exact: true }),
    ];
    const boxes = [];
    for (const control of controls) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(box.height).toBeGreaterThanOrEqual(42);
      boxes.push(box);
    }
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const [a, b] = [boxes[i], boxes[j]];
        const overlap = a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
        expect(overlap, `controls ${i} and ${j} overlap`).toBe(false);
      }
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await actions.getByRole("button", { name: aggregateLabel, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Monitor Planted Trees" });
    await dialog.locator(".psm-visit-choice").first().click();
    await expect(dialog.getByRole("heading", { name: "5. Individual Tree Assessment" })).toBeVisible();
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
  });
}

test("unauthenticated users are redirected by the real protected route", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=unauthenticated");
  await expect(page).toHaveURL(/\/login/);
});

test("disabled gate redirects direct monitoring routes and hides the sidebar entry", async ({ page }) => {
  await isolate(page, false);
  for (const [path, dashboard] of [
    ["/admin/permanent-sample-monitoring?role=admin", /\/admin\/dashboard/],
    ["/staff/permanent-sample-monitoring?role=staff", /\/staff\/dashboard/],
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(dashboard);
    await expect(
      page.getByRole("link", { name: monitoringLabel, includeHidden: true })
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { name: monitoringLabel })).toHaveCount(0);
  }
});

test("monitoring route contains no visit creation or scheduling controls", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff");
  await expectMonitoringPage(page);
  await expect(page.getByText(/create visit|manual visit id|testonly|schedule visit/i)).toHaveCount(0);
});

test("authorized staff and admin render only discovery visits returned by the API", async ({ page }) => {
  await isolate(page);
  for (const path of [
    "/staff/permanent-sample-monitoring?role=staff",
    "/admin/permanent-sample-monitoring?role=admin",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "VPMV-STAFF-001" })).toBeVisible();
    await expect(page.getByText(/DRAFT.*cohort-fixture.*site-fixture.*1\/2 assessed.*1 rechecking/)).toBeVisible();
    await expect(page.getByText("VPMV-NOT-RETURNED")).toHaveCount(0);
  }
});

test("discovery supports empty, loading, and network-failure states", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=empty");
  await expect(page.getByRole("status", { name: "" })).toContainText("No authorized monitoring visits are available.");

  await page.addInitScript(() => { window.__PHASE3C_DISCOVERY_GATE__ = new Promise(resolve => { window.__PHASE3C_RELEASE_DISCOVERY__ = resolve; }); });
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=loading");
  await expect(page.getByRole("status").filter({ hasText: "Loading monitoring visits" })).toBeVisible();
  await page.evaluate(() => window.__PHASE3C_RELEASE_DISCOVERY__());
  await expect(page.getByRole("button", { name: "VPMV-STAFF-001" })).toBeVisible();

  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=network-error");
  await expect(page.getByRole("alert")).toContainText("Monitoring network unavailable.");
});

test("status filtering and cursor pagination use only backend-provided cursors", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff");
  await expect(page.getByRole("button", { name: "VPMV-STAFF-001" })).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("button", { name: "VPMV-STAFF-002" })).toBeVisible();
  await expect(page.getByRole("button", { name: "VPMV-STAFF-001" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__PHASE3C_REQUESTS__.at(-1))).toContain("cursor=VPMV-STAFF-001");

  await page.getByRole("combobox", { name: "Status" }).selectOption("RETURNED");
  await expect(page.getByRole("button", { name: "VPMV-STAFF-002" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__PHASE3C_REQUESTS__.at(-1))).toBe("/verified-sample-monitoring/visits?status=RETURNED");
});

test("existing visit selection loads authoritative sample details", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff");
  await page.getByRole("button", { name: "VPMV-STAFF-001" }).click();
  await expect(page.getByRole("combobox", { name: "Verified Planting Report", exact: true })).toHaveValue("VPMV-STAFF-001");
  await expect(page.getByRole("group", { name: "TREE-001" }).getByRole("radio",{name:"Healthy",exact:true})).toBeChecked();
  await page.locator(".psm-tree-list button").filter({hasText:"TREE-002"}).click();
  await expect(page.getByRole("group", { name: "TREE-002" }).getByRole("radio",{name:"Needs Rechecking",exact:true})).toBeChecked();
  await page.getByRole("button",{name:"Previous Tree"}).click();
  await expect(page.getByText(/Previous assessment: Healthy/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__PHASE3C_REQUESTS__.at(-1))).toBe("/verified-sample-monitoring/visits/VPMV-STAFF-001");
  await expect(page.getByText(/private:\/\//)).toHaveCount(0);
  await expect(page.getByLabel(/visit id/i)).toHaveCount(0);
});

test("discovery and detail errors fail closed without private metadata", async ({ page }) => {
  // Seven independent navigation/error scenarios share this test's budget;
  // each response/UI assertion retains its own bounded failure timeout.
  test.setTimeout(60000);
  await isolate(page);
  for (const [fixture, expected] of [
    ["discovery-401", "Sign in is required."],
    ["discovery-403", "You are not authorized to view monitoring visits."],
    ["discovery-500", "Discovery unavailable."],
  ]) {
    await page.goto(`/staff/permanent-sample-monitoring?role=staff&fixture=${fixture}`);
    await expect(page.getByRole("alert")).toContainText(expected);
    await expect(page.getByText(/private:\/\//)).toHaveCount(0);
  }

  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=detail-404");
  await page.getByRole("button", { name: "VPMV-DETAIL-ERROR" }).click();
  await expect(page.getByRole("alert")).toContainText("This monitoring visit is unavailable.");
  await expect(page.getByText(/private:\/\//)).toHaveCount(0);

  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=detail-500");
  await page.getByRole("button", { name: "VPMV-DETAIL-SERVER-ERROR" }).click();
  await expect(page.getByRole("alert")).toContainText("Detail unavailable.");

  for (const [fixture, visitId, expected] of [
    ["detail-401", "VPMV-DETAIL-UNAUTHORIZED", "Sign in is required."],
    ["detail-403", "VPMV-DETAIL-FORBIDDEN", "Access is forbidden."],
  ]) {
    await page.goto(`/staff/permanent-sample-monitoring?role=staff&fixture=${fixture}`);
    await page.getByRole("button", { name: visitId }).click();
    await expect(page.getByRole("alert")).toContainText(expected);
    await expect(page.getByText(/private:\/\//)).toHaveCount(0);
  }
});

test("staff renders every authoritative sample in one editable visit form", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff");
  await page.getByRole("button", { name: "VPMV-STAFF-001" }).click();
  await expect(page.locator(".psm-tree-list button")).toHaveCount(2);
  await expect(page.getByRole("group", { name: "TREE-001" })).toBeVisible();
  await page.getByRole("button",{name:"Next Tree"}).click();
  await expect(page.getByRole("group", { name: "TREE-002" })).toBeVisible();
  await page.getByRole("button",{name:"Previous Tree"}).click();
  await expect(page.getByText(/Previous assessment: Healthy/)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "2/2 assessments recorded" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Visit" })).toBeVisible();
});

test("staff validates required rechecking data and saves the full versioned assessment payload", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff");
  await page.getByRole("button", { name: "VPMV-STAFF-001" }).click();
  await page.locator(".psm-tree-list button").filter({hasText:"TREE-002"}).click();
  await page.getByRole("group", { name: "TREE-002" }).getByLabel(/Remarks/).fill("");
  await page.getByRole("button", { name: "Save TREE-002 Draft" }).click();
  await expect(page.locator("[data-validation-field=\"TREE-002.remarks\"] [role=alert]")).toContainText("Explain why this tree needs rechecking.");

  await page.getByRole("group", { name: "TREE-002" }).getByLabel(/Remarks/).fill("Tag needs verification.");
  await page.getByRole("button",{name:"Previous Tree"}).click();
  await page.getByRole("group", { name: "TREE-001" }).getByLabel("Height (cm)").fill("123");
  await page.getByRole("button", { name: "Save TREE-001 Draft" }).click();
  await expect(page.getByText("Draft · Revision 5")).toBeVisible();
  const mutation = await page.evaluate(() => window.__PHASE3C_MUTATIONS__.at(-1));
  await expect(mutation.path).toBe("VPMV-STAFF-001");
  await expect(mutation.payload.expectedVersion).toBe(4);
  await expect(mutation.payload.submit).toBe(false);
  await expect(mutation.payload.assessments).toHaveLength(2);
  await expect(mutation.payload.assessments[0].heightCentimeters).toBe("123");
});

test("staff submits one complete visit and handles stale version conflicts safely", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff");
  await page.getByRole("button", { name: "VPMV-STAFF-001" }).click();
  await page.getByRole("button", { name: "Submit Visit" }).click();
  await expect(page.getByText("Pending Admin Review · Revision 5")).toBeVisible();
  const submit = await page.evaluate(() => window.__PHASE3C_MUTATIONS__.at(-1));
  await expect(submit.payload.submit).toBe(true);

  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=stale-save");
  await page.getByRole("button", { name: "VPMV-STAFF-001" }).click();
  await page.getByRole("button", { name: "Save TREE-001 Draft" }).click();
  await expect(page.getByRole("dialog",{name:"Monitor Planted Trees"}).getByRole("alert")).toContainText("This monitoring visit changed.");
});

test("returned visits support staff correction while approved visits and admin views stay read-only", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=returned");
  await page.getByRole("button", { name: "VPMV-RETURNED-001" }).click();
  await page.getByRole("group", { name: "TREE-001" }).getByLabel("Remarks").fill("Corrected after return.");
  await page.getByRole("button", { name: "Save TREE-001 Draft" }).click();
  await expect(page.getByText("Draft · Revision 8")).toBeVisible();
  const correction = await page.evaluate(() => window.__PHASE3C_MUTATIONS__.at(-1));
  await expect(correction.payload.expectedVersion).toBe(7);

  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=approved");
  await page.getByRole("button", { name: "VPMV-APPROVED-001" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Approved visits are read-only" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Save .* Draft|Submit Visit/ })).toHaveCount(0);

  await page.goto("/admin/permanent-sample-monitoring?role=admin&fixture=returned");
  await page.getByRole("button", { name: "VPMV-RETURNED-001" }).click();
  await expect(page.getByRole("button", { name: /Save .* Draft|Submit Visit/ })).toHaveCount(0);
});

test("staff capture creates a bound session and uploads one private evidence record", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff");
  await page.getByRole("button", { name: "VPMV-STAFF-001" }).click();
  await page.getByRole("button", { name: "Capture verified photo for TREE-001" }).click();
  await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Verified photo ready" })).toBeVisible();
  const binding = await page.evaluate(() => window.__PHASE3C_CAPTURE_BINDINGS__.at(-1));
  await expect(binding).toMatchObject({
    workflow: "sample-monitoring",
    cohortId: "cohort-fixture",
    siteId: "site-fixture",
    visitId: "VPMV-STAFF-001",
    sampleId: "TREE-001",
    visitVersion: 4,
    assessmentRevision: 0,
  });
  await page.getByRole("button", { name: "Upload verified photo for TREE-001" }).click();
  const upload = await page.evaluate(() => window.__PHASE3C_UPLOADS__.at(-1));
  await expect(upload).toMatchObject({
    visitId: "VPMV-STAFF-001",
    sampleId: "TREE-001",
    revision: 0,
    expectedVisitVersion: 4,
    idempotencyKey: expect.any(String),
  });
  await expect(page.getByRole("button", { name: "View private evidence revision 0" })).toBeVisible();
  await expect(page.getByText(/server-only-reference|storage\.googleapis/i)).toHaveCount(0);
});

test("authorized staff retrieves historical evidence through the protected route", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=returned");
  await page.getByRole("button", { name: "VPMV-RETURNED-001" }).click();
  await page.getByRole("button", { name: "View private evidence revision 0" }).click();
  await expect(page.getByAltText("Private evidence for TREE-001, revision 0")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__PHASE3C_REQUESTS__.at(-1))).toBe(
    "/evidence/sample-monitoring/visits/VPMV-RETURNED-001/samples/TREE-001/evidence/0"
  );
});

test("stale and unauthorized evidence requests fail closed without exposing private references", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=stale-upload");
  await page.getByRole("button", { name: "VPMV-STAFF-001" }).click();
  await page.getByRole("button", { name: "Capture verified photo for TREE-001" }).click();
  await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
  await page.getByRole("button", { name: "Upload verified photo for TREE-001" }).click();
  await expect(page.getByRole("dialog",{name:"Monitor Planted Trees"}).locator(".psm-error")).toContainText("Evidence changed while uploading.");
  await expect(page.getByText(/server-only-reference|storage\.googleapis/i)).toHaveCount(0);

  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=evidence-403");
  await page.getByRole("button", { name: "VPMV-STAFF-001" }).click();
  await page.getByRole("button", { name: "Capture verified photo for TREE-001" }).click();
  await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
  await page.getByRole("button", { name: "Upload verified photo for TREE-001" }).click();
  await page.getByRole("button", { name: "View private evidence revision 0" }).click();
  await expect(page.getByRole("dialog",{name:"Monitor Planted Trees"}).getByRole("alert")).toContainText("private evidence photo is unavailable");
});

test("returned correction keeps historical evidence while approved visits disable capture", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=returned");
  await page.getByRole("button", { name: "VPMV-RETURNED-001" }).click();
  await page.getByRole("group", { name: "TREE-001" }).getByLabel("Remarks").fill("Corrected after return.");
  await page.getByRole("button", { name: "Save TREE-001 Draft" }).click();
  await expect(page.getByRole("button", { name: "View private evidence revision 0" })).toBeVisible();
  await page.getByRole("button", { name: "Capture verified photo for TREE-001" }).click();
  await page.getByRole("button", { name: "Verify fixture camera photo" }).click();
  await page.getByRole("button", { name: "Upload verified photo for TREE-001" }).click();
  await expect(page.getByRole("button", { name: "View private evidence revision 0" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View private evidence revision 2" })).toBeVisible();

  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=approved");
  await page.getByRole("button", { name: "VPMV-APPROVED-001" }).click();
  await expect(page.getByRole("button", { name: /Capture verified photo|Upload verified photo/ })).toHaveCount(0);
});

test("admin reviews one consolidated pending visit with assessments, history, and private evidence", async ({ page }) => {
  await isolate(page);
  await page.goto("/admin/permanent-sample-monitoring?role=admin&fixture=review-pending");
  await page.getByRole("button", { name: "VPMV-PENDING-REVIEW-001" }).click();
  await expect(page.getByRole("combobox", { name: "Verified Planting Report", exact: true })).toHaveValue("VPMV-PENDING-REVIEW-001");
  await expect(page.getByText(/Cohort cohort-fixture.*Site site-fixture.*2\/2 assessments complete/)).toBeVisible();
  await expect(page.getByText(/TREE-001: Healthy.*height 120 cm.*diameter 6 cm.*Stable growth/)).toBeVisible();
  await expect(page.getByText(/TREE-002: Needs Rechecking.*Not Located After Rechecking/)).toBeVisible();
  await expect(page.getByText("Version 11: PENDING_ADMIN_APPROVAL")).toBeVisible();
  await expect(page.getByRole("button", { name: "View private evidence revision 0" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve Visit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Return for Correction" })).toBeVisible();
});

test("admin validates return reason and posts one versioned approval decision", async ({ page }) => {
  await isolate(page);
  await page.goto("/admin/permanent-sample-monitoring?role=admin&fixture=review-pending");
  await page.getByRole("button", { name: "VPMV-PENDING-REVIEW-001" }).click();
  await page.getByRole("button", { name: "Return for Correction" }).click();
  await expect(page.getByRole("dialog",{name:"Review Monitoring Visit"}).getByRole("alert")).toContainText("A return reason is required");
  expect(await page.evaluate(() => window.__PHASE3C_REVIEWS__ || [])).toHaveLength(0);

  await page.getByRole("button", { name: "Approve Visit" }).click();
  await expect(page.getByText("Approved · Revision 11")).toBeVisible();
  const review = await page.evaluate(() => window.__PHASE3C_REVIEWS__.at(-1));
  await expect(review).toEqual({
    visitId: "VPMV-PENDING-REVIEW-001",
    payload: { expectedVersion: 11, approve: true, reasons: "" },
  });
  await expect(page.getByRole("button", { name: /Approve Visit|Return for Correction/ })).toHaveCount(0);
  expect(await page.evaluate(() => window.__PHASE3C_REVIEWS__)).toHaveLength(1);
});

test("admin returns a visit with reason while staff cannot access review actions", async ({ page }) => {
  await isolate(page);
  await page.goto("/admin/permanent-sample-monitoring?role=admin&fixture=review-pending");
  await page.getByRole("button", { name: "VPMV-PENDING-REVIEW-001" }).click();
  await page.getByLabel("Return reason").fill("Please verify TREE-002 location.");
  await page.getByRole("button", { name: "Return for Correction" }).click();
  await expect(page.getByText("Returned for Correction · Revision 11")).toBeVisible();
  await expect(page.getByText("Review reason: Please verify TREE-002 location.")).toBeVisible();
  const returned = await page.evaluate(() => window.__PHASE3C_REVIEWS__.at(-1));
  await expect(returned.payload).toEqual({
    expectedVersion: 11,
    approve: false,
    reasons: "Please verify TREE-002 location.",
  });

  await page.goto("/staff/permanent-sample-monitoring?role=staff&fixture=review-pending");
  await page.getByRole("button", { name: "VPMV-PENDING-REVIEW-001" }).click();
  await expect(page.getByRole("button", { name: /Approve Visit|Return for Correction/ })).toHaveCount(0);
});

test("stale and failed admin reviews retain the authoritative pending state", async ({ page }) => {
  await isolate(page);
  await page.goto("/admin/permanent-sample-monitoring?role=admin&fixture=review-stale");
  await page.getByRole("button", { name: "VPMV-PENDING-REVIEW-001" }).click();
  await page.getByRole("button", { name: "Approve Visit" }).click();
  await expect(page.getByRole("dialog",{name:"Review Monitoring Visit"}).getByRole("alert")).toContainText("This monitoring visit changed.");
  await expect(page.getByText("Pending Admin Review · Revision 11")).toBeVisible();

  await page.goto("/admin/permanent-sample-monitoring?role=admin&fixture=review-failure");
  await page.getByRole("button", { name: "VPMV-PENDING-REVIEW-001" }).click();
  await page.getByRole("button", { name: "Approve Visit" }).click();
  await expect(page.getByRole("dialog",{name:"Review Monitoring Visit"}).getByRole("alert")).toContainText("Review service is unavailable.");
});

// Historical aggregate monitoring: follow-up observations for an existing lifecycle stay available from the
// lifecycle row's existing "More actions" menu, separate from the permanent-sample modal and header button.
const aggregateLifecycle = { id: "lifecycle-fixture", recordType: "monitoringLifecycle", plantingReportId: "phase3c-staff-report", plantingReportNumber: "TEST-STAFF-MONITORING",
  participantId: "requester-fixture", participantName: "Requester Fixture", siteId: "site-fixture", siteName: "Bulan Test Site", barangay: "Bulan", species: "Narra",
  quantityPlanted: 10, authoritativePlantingDate: "2026-10-01", startMonitoringDate: "2026-10-15", nextMonitoringDate: "2026-11-15", monitoringEndDate: "2028-10-01",
  status: "Next Monitoring Scheduled", archived: false,
  history: [{ id: "obs-1", workflowVersion: 2, observationType: "official", workflowStatus: "Approved", monitoredDate: "2026-10-15", totalMonitored: 10, healthyCount: 9, damagedCount: 1, deadCount: 0, maturityStatus: "Immature" }] };

test("Staff records a follow-up aggregate observation from the lifecycle row, not from the header button", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page, { monitoring: [aggregateLifecycle] });
  await page.goto("/staff/survival-monitoring?role=staff");
  await expect(staffSubmissionControls(page)).toHaveCount(1);
  const row = page.locator("tbody tr").filter({ hasText: "Bulan Test Site" });
  await expect(row).toHaveCount(1);
  await row.getByTitle("More actions").click();
  await row.getByRole("button", { name: "Record Aggregate Observation", exact: true }).click();
  const legacy = page.locator(".sm-modal");
  await expect(legacy).toBeVisible();
  await expect(legacy.getByRole("heading", { name: "Record Aggregate Monitoring Observation" })).toBeVisible();
  await expect(legacy.locator('select[data-monitoring-field="plantingReportId"]')).toHaveValue("phase3c-staff-report");
  await expect(legacy.locator('[data-monitoring-field="totalChecked"]')).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Monitor Planted Trees" })).toHaveCount(0);
  await expect(staffSubmissionControls(page)).toHaveCount(1);
});

test("archived and completed aggregate lifecycles and Admin users get no aggregate observation action", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page, { monitoring: [{ ...aggregateLifecycle, status: "Monitoring Completed" }] });
  await page.goto("/staff/survival-monitoring?role=staff");
  const row = page.locator("tbody tr").filter({ hasText: "Bulan Test Site" });
  await row.getByTitle("More actions").click();
  await expect(row.getByRole("button", { name: "Record Aggregate Observation", exact: true })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Archive Record", exact: true })).toBeVisible();
  await page.goto("/admin/survival-monitoring?role=admin");
  const adminRow = page.locator("tbody tr").filter({ hasText: "Bulan Test Site" });
  await adminRow.getByTitle("More actions").click();
  await expect(adminRow.getByRole("button", { name: "Record Aggregate Observation", exact: true })).toHaveCount(0);
});

// Aggregate observation role rules: only the original Staff reporter corrects a returned observation,
// Staff never review their own observation, and Admin has no monitoring-creation affordances.
const returnedEntry = (originalReporterId) => ({ id: "obs-returned", workflowVersion: 2, observationType: "official",
  reviewStatus: "Returned for Rechecking", reviewVersion: 1, returnReason: "Recount the damaged trees.", originalReporterId,
  monitoredDate: "2026-10-15", totalMonitored: 10, healthyCount: 9, damagedCount: 1, deadCount: 0, maturityStatus: "Immature" });
const pendingEntry = (originalReporterId) => ({ ...returnedEntry(originalReporterId), id: "obs-pending", reviewStatus: "Pending Review", reviewVersion: 0, returnReason: "" });
async function openLifecycleDetail(page, role, entry) {
  await mockLegacyMonitoringApi(page, { monitoring: [{ ...aggregateLifecycle, history: [entry] }] });
  await page.goto(`/${role}/survival-monitoring?role=${role}`);
  await page.locator("tbody tr").filter({ hasText: "Bulan Test Site" }).getByTitle("View monitoring record").click();
  await expect(page.getByRole("heading", { name: "Survival Monitoring Details" })).toBeVisible();
}

test("returned aggregate observation: Edit and Resubmit only for its original Staff reporter; reason stays visible", async ({ page }) => {
  await isolate(page);
  await openLifecycleDetail(page, "staff", returnedEntry("test-staff"));
  await expect(page.getByText("Returned for rechecking: Recount the damaged trees.")).toBeVisible();
  await page.getByRole("button", { name: "Edit and Resubmit" }).click();
  await expect(page.locator(".sm-modal").getByRole("heading", { name: "Edit Returned Monitoring Observation" })).toBeVisible();
});

test("returned aggregate observation: other Staff and Admin see status and reason but no resubmit action", async ({ page }) => {
  await isolate(page);
  for (const [role, reporter] of [["staff", "other-staff"], ["admin", "test-staff"], ["admin", "test-admin"]]) {
    await openLifecycleDetail(page, role, returnedEntry(reporter));
    await expect(page.getByText("Returned for rechecking: Recount the damaged trees.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit and Resubmit" })).toHaveCount(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await isolate(page);
  }
});

test("Staff cannot review their own pending aggregate observation; a different Staff member can", async ({ page }) => {
  await isolate(page);
  await openLifecycleDetail(page, "staff", pendingEntry("test-staff"));
  await expect(page.getByRole("button", { name: "Review", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Return for Rechecking", exact: true })).toHaveCount(0);
  await expect(page.getByText("You reported this observation. Another MENRO Staff member must review it.")).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await isolate(page);
  await openLifecycleDetail(page, "staff", pendingEntry("other-staff"));
  await expect(page.getByRole("button", { name: "Review", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Return for Rechecking", exact: true })).toBeVisible();
  await expect(page.getByText("You reported this observation.")).toHaveCount(0);
});

test("Monitor Planted Trees appears only for Staff; Admin has no such button", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page);
  for (const [role, buttons] of [["staff", 1], ["admin", 0]]) {
    await page.goto(`/${role}/survival-monitoring?role=${role}`);
    await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
    await expect(page.getByRole("button", { name: aggregateLabel, exact: true })).toHaveCount(buttons);
    await expect(page.locator('[data-testid="monitor-planted-trees-add-icon"]')).toHaveCount(buttons);
  }
});

test("Admin keeps Archive with a confirmation; cancelling sends no archive request", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page, { monitoring: [aggregateLifecycle] });
  const archiveCalls = [];
  page.on("request", request => { if (request.url().includes("/archive")) archiveCalls.push(request.url()); });
  await page.goto("/admin/survival-monitoring?role=admin");
  const row = page.locator("tbody tr").filter({ hasText: "Bulan Test Site" });
  await row.getByTitle("More actions").click();
  let prompt = "";
  page.once("dialog", dialog => { prompt = dialog.message(); return dialog.dismiss(); });
  await row.getByRole("button", { name: "Archive Record", exact: true }).click();
  await expect.poll(() => prompt).toContain("Archive monitoring record");
  expect(archiveCalls).toEqual([]);
  await expect(row).toHaveCount(1);
});

// Admin Monitoring Records: Staff-submitted permanent-sample visits share the existing table and View action.
const visitRow = (page, id) => page.locator(`tr[data-sample-visit-row="${id}"]`);
async function openAdminRecords(page, fixture = "admin-records") {
  await isolate(page);
  await mockLegacyMonitoringApi(page, { monitoring: [{ id: "MON-AGG-001", monitoringNumber: "MON-2026-001", plantingReportId: "phase3c-staff-report", plantingReportNumber: "TEST-STAFF-MONITORING", siteName: "Bulan Test Site", barangay: "Bulan", species: "Narra", condition: "Healthy", status: "Active Monitoring", history: [] }] });
  const writes = [];
  page.on("request", request => { if (request.method() !== "GET" && /\/api\/(monitoring|sample-monitoring-information)/.test(request.url())) writes.push(request.url()); });
  await page.goto(`/admin/survival-monitoring?role=admin&fixture=${fixture}`);
  await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
  return writes;
}

test("Admin Monitoring Records lists submitted permanent-sample visits beside aggregate records, never drafts, with no separate section", async ({ page }) => {
  await openAdminRecords(page);
  const table = page.locator(".sm-records-card table.sm-table");
  await expect(table.getByText("MON-2026-001")).toBeVisible();
  const pending = visitRow(page, "VPMV-PENDING-REVIEW-001");
  await expect(pending).toContainText("RPT-2026-101");
  await expect(pending).toContainText("Bical Reforestation Site");
  await expect(pending).toContainText("Pending Admin Review");
  await expect(pending).toContainText("Submitted by Ana Staff");
  await expect(pending).toContainText("Monitored");
  await expect(pending).toContainText("2/2 sample trees assessed");
  await expect(visitRow(page, "VPMV-APPROVED-001")).toContainText("Approved");
  await expect(visitRow(page, "VPMV-APPROVED-001")).toContainText("Submitted by Ben Staff");
  await expect(visitRow(page, "VPMV-ADMIN-DRAFT-001")).toHaveCount(0);
  await expect(page.getByText(/Monitoring Visits for Review/)).toHaveCount(0);
  await expect(page.locator(".sm-records-card")).toHaveCount(1);
  await expect(page.locator(".sm-table-footer")).toContainText("of 3 records");
  await expect(page.locator(".sm-header-actions").getByRole("button", { name: /Monitor|Submit|Create/ })).toHaveCount(0);
  await expect(pending.getByRole("button")).toHaveCount(1);
  await expect(pending.getByRole("button", { name: "View monitoring visit VPMV-PENDING-REVIEW-001" })).toBeVisible();
});

test("existing Monitoring Records filters apply to visit rows", async ({ page }) => {
  await openAdminRecords(page);
  const search = page.locator(".sm-search-wrap input");
  await search.fill("Ana Staff");
  await expect(visitRow(page, "VPMV-PENDING-REVIEW-001")).toBeVisible();
  await expect(visitRow(page, "VPMV-APPROVED-001")).toHaveCount(0);
  await expect(page.locator(".sm-records-card").getByText("MON-2026-001")).toHaveCount(0);
  await search.fill("");
  await page.locator("select").filter({ hasText: "All Conditions" }).selectOption("Healthy");
  await expect(visitRow(page, "VPMV-PENDING-REVIEW-001")).toHaveCount(0);
  await expect(page.locator(".sm-records-card").getByText("MON-2026-001")).toBeVisible();
});

test("View opens the Admin read-only seven-section form titled Review Monitoring Visit with Approve and Return only at the bottom", async ({ page }) => {
  const writes = await openAdminRecords(page);
  await visitRow(page, "VPMV-PENDING-REVIEW-001").getByRole("button", { name: /View monitoring visit/ }).click();
  const dialog = page.getByRole("dialog", { name: "Review Monitoring Visit" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Monitor Planted Trees" })).toHaveCount(0);
  await expect(dialog.getByRole("heading", { name: "Review Monitoring Visit", exact: true })).toBeVisible();
  await expect(dialog.locator(".psm-status-badge")).toHaveText("Pending Admin Review");
  for (const heading of blueprintSections) await expect(dialog.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "Healthy" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: /Save .*Draft|Save Draft|Submit|Take Photo|Capture verified photo|Upload|Create/ })).toHaveCount(0);
  await expect(dialog.locator(".psm-shell")).toHaveCount(0);
  const decision = dialog.locator("footer.psm-footer").getByRole("group", { name: "Admin visit decision" });
  await expect(decision.getByRole("button", { name: "Approve Visit", exact: true })).toBeEnabled();
  await expect(decision.getByRole("button", { name: "Return for Correction", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Approve Visit", exact: true })).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "Return for Correction", exact: true })).toHaveCount(1);
  const footerIsLast = await dialog.locator("footer.psm-footer").evaluate(node => node === node.parentElement.lastElementChild);
  expect(footerIsLast).toBe(true);
  await decision.getByRole("button", { name: "Approve Visit", exact: true }).click();
  await expect(dialog.locator(".psm-status-badge")).toHaveText("Approved");
  await expect(dialog.getByRole("button", { name: /Approve Visit|Return for Correction/ })).toHaveCount(0);
  expect(await page.evaluate(() => window.__PHASE3C_REVIEWS__.map(entry => [entry.visitId, entry.payload.approve]))).toEqual([["VPMV-PENDING-REVIEW-001", true]]);
  await dialog.getByRole("button", { name: "Close monitoring visit" }).click();
  await expect(visitRow(page, "VPMV-PENDING-REVIEW-001")).toContainText("Approved");
  expect(writes).toEqual([]);
});

test("Return for Correction from the bottom still requires a reason", async ({ page }) => {
  await openAdminRecords(page);
  await visitRow(page, "VPMV-PENDING-REVIEW-001").getByRole("button", { name: /View monitoring visit/ }).click();
  const dialog = page.getByRole("dialog", { name: "Review Monitoring Visit" });
  await dialog.locator("footer.psm-footer").getByRole("button", { name: "Return for Correction", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("A return reason is required");
  expect(await page.evaluate(() => window.__PHASE3C_REVIEWS__ || [])).toEqual([]);
  await dialog.getByLabel("Return reason").fill("Recheck TREE-002 tag.");
  await dialog.locator("footer.psm-footer").getByRole("button", { name: "Return for Correction", exact: true }).click();
  await expect(dialog.locator(".psm-status-badge")).toHaveText("Returned for Correction");
  await dialog.getByRole("button", { name: "Close monitoring visit" }).click();
  await expect(visitRow(page, "VPMV-PENDING-REVIEW-001")).toContainText("Returned for Correction");
});

test("approved visits open read-only with no Approve or Return", async ({ page }) => {
  await openAdminRecords(page);
  await visitRow(page, "VPMV-APPROVED-001").getByRole("button", { name: /View monitoring visit/ }).click();
  const dialog = page.getByRole("dialog", { name: "Review Monitoring Visit" });
  await expect(dialog.locator(".psm-status-badge")).toHaveText("Approved");
  await expect(dialog.getByRole("button", { name: /Approve Visit|Return for Correction|Save|Submit|Take Photo|Upload/ })).toHaveCount(0);
});

test("write-paused visits stay viewable but never offer Approve or Return", async ({ page }) => {
  await openAdminRecords(page, "admin-records-paused");
  await expect(page.locator(".sm-records-header")).toContainText("Permanent-sample changes are paused");
  await visitRow(page, "VPMV-PENDING-REVIEW-001").getByRole("button", { name: /View monitoring visit/ }).click();
  const dialog = page.getByRole("dialog", { name: "Review Monitoring Visit" });
  await expect(dialog).toContainText("Approve and Return are unavailable");
  await expect(dialog.getByRole("button", { name: /Approve Visit|Return for Correction/ })).toHaveCount(0);
});

test("visit list errors are plain text, retryable, and leave aggregate records intact", async ({ page }) => {
  await openAdminRecords(page, "index-missing-raw");
  const header = page.locator(".sm-records-header");
  await expect(header.getByRole("alert")).toContainText("required database index is not ready");
  await expect(header).not.toContainText(/FAILED_PRECONDITION|console\.firebase|create_composite/);
  await expect(header.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.locator(".sm-records-card").getByText("MON-2026-001")).toBeVisible();
});

test("feature-disabled gate: Admin records load no visit rows and request no visit list", async ({ page }) => {
  await isolate(page, false);
  await mockLegacyMonitoringApi(page);
  await page.goto("/admin/survival-monitoring?role=admin&fixture=admin-records");
  await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
  await expect(page.locator("tr[data-sample-visit-row]")).toHaveCount(0);
  expect(await page.evaluate(() => (window.__PHASE3C_REQUESTS__ || []).filter(path => String(path).startsWith("/verified-sample-monitoring/visits")))).toEqual([]);
});

test("Staff Survival Monitoring shows no Admin visit rows and keeps Monitor Planted Trees", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page);
  await page.goto("/staff/survival-monitoring?role=staff&fixture=admin-records");
  await expect(page.locator(".sm-header-actions").getByRole("button", { name: "Monitor Planted Trees", exact: true })).toBeVisible();
  await expect(page.locator("tr[data-sample-visit-row]")).toHaveCount(0);
});

test("Admin Monitoring Records reads every page: a pending visit behind six draft-only pages is listed and reviewable", async ({ page }) => {
  await openAdminRecords(page, "admin-records-many-pages");
  const pending = visitRow(page, "VPMV-PENDING-REVIEW-001");
  await expect(pending).toContainText("Pending Admin Review");
  await expect(visitRow(page, "VPMV-APPROVED-001")).toBeVisible();
  await expect(page.locator("tr[data-sample-visit-row^='VPMV-DRAFT-']")).toHaveCount(0);
  await expect(page.locator(".sm-records-header")).not.toContainText("Not every permanent-sample visit");
  const listCalls = await page.evaluate(() => window.__PHASE3C_REQUESTS__.filter(path => String(path).startsWith("/verified-sample-monitoring/visits?")));
  expect(listCalls).toHaveLength(7);
  for (const path of listCalls) expect(path).toContain("labels=1");
  await pending.getByRole("button", { name: /View monitoring visit/ }).click();
  await expect(page.getByRole("dialog", { name: "Review Monitoring Visit" }).locator("footer.psm-footer").getByRole("button", { name: "Approve Visit", exact: true })).toBeEnabled();
});

test("a timed-out Approve confirmed with Check saved outcome refreshes the Monitoring Records row", async ({ page }) => {
  await page.clock.install();
  await openAdminRecords(page, "admin-records-review-timeout");
  await visitRow(page, "VPMV-PENDING-REVIEW-001").getByRole("button", { name: /View monitoring visit/ }).click();
  const dialog = page.getByRole("dialog", { name: "Review Monitoring Visit" });
  await dialog.locator("footer.psm-footer").getByRole("button", { name: "Approve Visit", exact: true }).click();
  await page.clock.runFor(61_000);
  await expect(dialog.getByRole("button", { name: "Check saved outcome" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Approve Visit", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Check saved outcome" }).click();
  await expect(dialog.locator(".psm-status-badge")).toHaveText("Approved");
  await expect(dialog.getByRole("button", { name: /Approve Visit|Return for Correction/ })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close monitoring visit" }).click();
  await expect(visitRow(page, "VPMV-PENDING-REVIEW-001")).toContainText("Approved");
  expect(await page.evaluate(() => window.__PHASE3C_REVIEWS__.length)).toBe(1);
});

test("failed label lookups show Submitter unavailable and a notice, never a guessed name", async ({ page }) => {
  await openAdminRecords(page, "admin-records-labels-incomplete");
  const pending = visitRow(page, "VPMV-PENDING-REVIEW-001");
  await expect(pending).toContainText("Submitter unavailable");
  await expect(pending).not.toContainText("Submitted by");
  await expect(page.locator(".sm-records-header")).toContainText("labels could not be loaded");
});

test("review-mode form keeps an accessible description when the selected visit cannot be opened", async ({ page }) => {
  await openAdminRecords(page, "admin-records-detail-error");
  await visitRow(page, "VPMV-PENDING-REVIEW-001").getByRole("button", { name: /View monitoring visit/ }).click();
  const dialog = page.getByRole("dialog", { name: "Review Monitoring Visit" });
  const select = dialog.getByRole("combobox", { name: "Verified Planting Report" });
  await expect(select).toHaveAccessibleDescription(/could not be opened/);
  await expect(dialog.locator("#psm-shell-reason")).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: /Approve Visit|Return for Correction|Save Draft|Submit/ })).toHaveCount(0);
});

// Read-only tracking of Admin-verified planting reports in Survival Monitoring (no records are created).
const verifiedReport = (id, reportNumber, monitoring, extra = {}) => ({ id, reportNumber, verificationStatus: "Completed", reportingProgress: "Completed",
  siteName: `${reportNumber} Site`, barangay: "Bical", plantingDate: "2026-10-01", acceptedQuantity: 20, ...(monitoring ? { reportingPolicy: { monitoring } } : {}), ...extra });
const trackingReports = [
  verifiedReport("report-spot", "RPT-2026-020", "STAFF_SPOT_CHECK"),
  verifiedReport("report-perm", "RPT-2026-101", "PERMANENT_SAMPLE"),
  verifiedReport("report-cohort", "RPT-2026-102", "PERMANENT_SAMPLE"),
  verifiedReport("report-legacy", "RPT-2026-103", null),
  verifiedReport("report-tracked", "RPT-2026-104", "STAFF_SPOT_CHECK"),
  { ...verifiedReport("report-pending", "RPT-2026-105", "STAFF_SPOT_CHECK"), verificationStatus: "Pending", reportingProgress: "Awaiting Submission" },
];
const trackedLifecycle = { id: "MON-TRACKED-001", monitoringNumber: "MON-2026-004", plantingReportId: "report-tracked", plantingReportNumber: "RPT-2026-104",
  siteName: "RPT-2026-104 Site", barangay: "Bical", species: "Narra", condition: "Healthy", status: "Active Monitoring", history: [] };
// cohort-pending matches the mock readiness entry (sampling plan draft, scheduling policy pending).
const trackingCohorts = [{ id: "cohort-pending", verifiedPlantedQuantity: 18, source: { plantingReportId: "report-cohort" }, samplingPlan: { status: "DRAFT" }, baseline: { approvalStatus: "NOT_STARTED" } }];
const trackingRow = (page, id) => page.locator(`tr[data-tracking-row="${id}"]`);
const shellValue = (dialog, label) => dialog.locator(".psm-shell dt", { hasText: label }).locator("xpath=following-sibling::dd");
async function openTracking(page, role, { fixture = "", gate = true, cohorts = trackingCohorts } = {}) {
  await isolate(page, gate);
  await page.addInitScript(rows => { window.__PHASE3C_COHORTS__ = rows; }, cohorts);
  await mockLegacyMonitoringApi(page, { monitoring: [trackedLifecycle], plantingReports: trackingReports });
  const writes = [];
  page.on("request", request => { if (request.method() !== "GET" && request.url().includes("/api/")) writes.push(request.url()); });
  await page.goto(`/${role}/survival-monitoring?role=${role}${fixture ? `&fixture=${fixture}` : ""}`);
  await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
  return writes;
}

for (const role of ["staff", "admin"]) test(`${role} Monitoring Lifecycles list Admin-verified reports as tracking-only rows with their actual monitoring status`, async ({ page }) => {
  const writes = await openTracking(page, role, { fixture: role === "admin" ? "admin-records" : "" });
  const table = page.locator(".sm-records-card table.sm-table");
  await expect(table.getByText("MON-2026-004")).toBeVisible();
  await expect(page.locator("tr[data-tracking-row]")).toHaveCount(4);
  await expect(trackingRow(page, "report-spot")).toContainText("Awaiting MENRO spot-check procedure");
  await expect(trackingRow(page, "report-spot")).toContainText("Staff spot-check");
  await expect(trackingRow(page, "report-perm")).toContainText("Monitoring setup pending");
  await expect(trackingRow(page, "report-cohort")).toContainText("Monitoring setup in progress");
  await expect(trackingRow(page, "report-cohort")).toContainText("Sampling plan: Draft · Baseline: Not Started · Visit: Not ready");
  await expect(trackingRow(page, "report-legacy")).toContainText("Awaiting first observation");
  // A report with an actual lifecycle is shown only by that lifecycle; unverified reports are not tracked.
  await expect(trackingRow(page, "report-tracked")).toHaveCount(0);
  await expect(trackingRow(page, "report-pending")).toHaveCount(0);
  for (const id of ["report-spot", "report-perm", "report-cohort", "report-legacy"]) {
    const row = trackingRow(page, id);
    await expect(row).toContainText("Tracking only");
    await expect(row).toContainText("No observation yet");
    await expect(row.getByRole("button")).toHaveCount(0);
    await expect(row.getByRole("link")).toHaveCount(1);
  }
  await expect(trackingRow(page, "report-spot").getByRole("link", { name: "View verified planting report RPT-2026-020" }))
    .toHaveAttribute("href", `/${role}/planting-reports?report=report-spot`);
  // Tracking rows are never counted as monitoring records or observations.
  const footer = page.locator(".sm-table-footer");
  await expect(footer).toContainText(role === "admin" ? "of 3 records" : "of 1 records");
  await expect(footer).toContainText("4 verified planting reports awaiting monitoring (tracking only, not monitoring records)");
  for (const label of ["Approved Full Cohorts", "Total Trees Monitored"])
    await expect(page.locator(".sm-kpi-label", { hasText: label }).locator("xpath=following-sibling::div[contains(@class,'sm-kpi-value')]")).toHaveText("0");
  if (role === "admin") await expect(page.locator(".sm-header-actions").getByRole("button", { name: /Monitor|Submit|Create/ })).toHaveCount(0);
  // Existing filters: species/condition exclude tracking rows; search matches their status.
  await page.locator(".sm-search-wrap input").fill("spot-check");
  await expect(page.locator("tr[data-tracking-row]")).toHaveCount(1);
  await page.locator(".sm-search-wrap input").fill("");
  await page.locator("select").filter({ hasText: "All Conditions" }).selectOption("Healthy");
  await expect(page.locator("tr[data-tracking-row]")).toHaveCount(0);
  await expect(table.getByText("MON-2026-004")).toBeVisible();
  expect(writes).toEqual([]);
});

test("Staff Monitor Planted Trees offers verified reports under Setup Pending with truthful readiness and nothing editable", async ({ page }) => {
  const writes = await openTracking(page, "staff", { fixture: "empty" });
  await page.locator(".sm-header-actions").getByRole("button", { name: "Monitor Planted Trees", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Monitor Planted Trees" });
  await expect(dialog).toBeVisible();
  const select = dialog.getByRole("combobox", { name: "Verified Planting Report", exact: true });
  await expect(select).toBeEnabled();
  await expect(select.locator('optgroup[label="Setup Pending"] option')).toHaveCount(4);
  await expect(select.locator('option[value="pending:report-tracked"], option[value="pending:report-pending"]')).toHaveCount(0);
  await select.selectOption("pending:report-spot");
  const pending = dialog.locator('section[data-setup-pending-report="report-spot"]');
  await expect(pending.getByRole("heading", { name: "Setup pending: RPT-2026-020" })).toBeVisible();
  await expect(pending).toContainText("Staff spot-check");
  await expect(pending).toContainText("Awaiting MENRO spot-check procedure");
  await expect(pending).toContainText(/Monitoring workflow pending MENRO policy/);
  await expect(shellValue(dialog, "Planting Report ID")).toHaveText("RPT-2026-020");
  await expect(shellValue(dialog, "Planting Report Status")).toHaveText("Verified");
  await expect(shellValue(dialog, "Sampling Plan Status")).toHaveText("Not applicable (Staff spot-check)");
  await expect(select).toHaveAccessibleDescription(/no authorized monitoring visit yet/);
  for (const name of ["Take Photo", "Upload Existing Photo", "Verify Photo Location", "Save Draft", "Submit Visit"])
    await expect(dialog.getByRole("button", { name, exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("Date Monitored *", { exact: true })).toBeDisabled();
  await select.selectOption("pending:report-cohort");
  const cohort = dialog.locator('section[data-setup-pending-report="report-cohort"]');
  await expect(cohort).toContainText("Sampling plan: Draft · Baseline: Not Started · Visit: Not ready");
  await expect(cohort.getByRole("list", { name: "Why this report has no monitoring visit" })).toContainText("New monitoring visits can start only after MENRO approves the visit scheduling policy.");
  await expect(shellValue(dialog, "Sampling Plan Status")).toHaveText("Draft");
  await expect(shellValue(dialog, "Verified Planted Quantity")).toHaveText("18");
  await expect(dialog.getByRole("button", { name: "Save Draft", exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
});

test("real visit selection still works beside Setup Pending reports", async ({ page }) => {
  await openTracking(page, "staff", { fixture: "returned" });
  await page.locator(".sm-header-actions").getByRole("button", { name: "Monitor Planted Trees", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Monitor Planted Trees" });
  const select = dialog.getByRole("combobox", { name: "Verified Planting Report", exact: true });
  await expect(select).toHaveValue("VPMV-RETURNED-001");
  await expect(select.locator('optgroup[label="Setup Pending"] option')).toHaveCount(4);
  await select.selectOption("pending:report-perm");
  await expect(dialog.locator('section[data-setup-pending-report="report-perm"]')).toContainText("Monitoring setup pending");
  await expect(dialog.getByRole("button", { name: "Save Draft", exact: true })).toBeDisabled();
  await dialog.locator(".psm-visit-choice").first().click();
  await expect(select).toHaveValue("VPMV-RETURNED-001");
  await expect(dialog.locator("section[data-setup-pending-report]")).toHaveCount(0);
});

test("a failed monitoring-setup lookup keeps tracking rows truthful and can be retried", async ({ page }) => {
  await openTracking(page, "staff", { fixture: "tracking-cohort-error" });
  const header = page.locator(".sm-records-header");
  await expect(header.getByRole("alert")).toContainText("Monitoring setup status for verified planting reports could not be loaded");
  await expect(trackingRow(page, "report-cohort")).toContainText("Monitoring setup status unavailable");
  await expect(trackingRow(page, "report-spot")).toContainText("Awaiting MENRO spot-check procedure");
  await page.evaluate(() => { window.__PHASE3C_COHORTS_RECOVERED__ = true; });
  await header.getByRole("button", { name: "Retry setup status" }).click();
  await expect(trackingRow(page, "report-cohort")).toContainText("Monitoring setup in progress");
  await expect(header.getByRole("alert")).toHaveCount(0);
});

test("feature-disabled: tracking rows stay truthful and no cohort or readiness lookup is made", async ({ page }) => {
  await openTracking(page, "staff", { gate: false });
  await expect(trackingRow(page, "report-perm")).toContainText("Permanent-sample monitoring not available");
  await expect(trackingRow(page, "report-spot")).toContainText("Awaiting MENRO spot-check procedure");
  expect(await page.evaluate(() => [window.__PHASE3C_COHORT_CALLS__ || 0, window.__PHASE3C_READINESS_CALLS__ || 0])).toEqual([0, 0]);
});

test("Participants never reach tracking rows or trigger setup lookups", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page, { monitoring: [trackedLifecycle], plantingReports: trackingReports });
  await page.goto("/participant/survival-monitoring?role=participant");
  await expect(page).toHaveURL(/\/participant\/my-planting-reports/);
  await expect(page.locator("tr[data-tracking-row]")).toHaveCount(0);
  expect(await page.evaluate(() => window.__PHASE3C_COHORT_CALLS__ || 0)).toBe(0);
});
