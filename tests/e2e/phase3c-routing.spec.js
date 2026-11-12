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

async function mockLegacyMonitoringApi(page) {
  await page.route("http://localhost:5000/api/**", (route) => {
    const url = new URL(route.request().url());
    const data = url.pathname === "/api/monitoring" ? []
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

test("admin fixture opens the real admin monitoring route when the gate is enabled", async ({ page }) => {
  await isolate(page);
  await page.goto("/admin/permanent-sample-monitoring?role=admin");
  await expectMonitoringPage(page);
  await expect(
    page.getByRole("link", { name: monitoringLabel, includeHidden: true })
  ).toHaveCount(1);
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

test("staff fixture opens the real staff monitoring route when the gate is enabled", async ({ page }) => {
  await isolate(page);
  await page.goto("/staff/permanent-sample-monitoring?role=staff");
  await expectMonitoringPage(page);
  const monitoringLink = page.getByRole("link", {
    name: monitoringLabel,
    includeHidden: true,
  });
  await expect(monitoringLink).toHaveCount(1);
  await expect(monitoringLink).toHaveAttribute(
    "href",
    "/staff/permanent-sample-monitoring"
  );
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

const aggregateLabel = "Submit Aggregate Monitoring Record";
const sampleTreeLabel = "Monitor Permanent Sample Trees";

test("Staff can open the legacy aggregate monitoring form while Admin remains read-only", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page);
  await page.goto("/staff/survival-monitoring?role=staff");
  await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Monitoring Record", exact: true })).toHaveCount(0);
  const submitButton = page.getByRole("button", { name: aggregateLabel, exact: true });
  await expect(submitButton).toBeVisible();
  await submitButton.click();
  // The aggregate button opens the legacy modal in place; it must never route to the per-tree form.
  await expect(page).toHaveURL(/\/staff\/survival-monitoring/);
  const modal = page.locator(".sm-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("heading", { name: "Monitor Planted Trees" })).toBeVisible();
  await expect(modal.getByRole("button", { name: aggregateLabel, exact: true })).toBeVisible();
  await expect(modal.locator('select[data-monitoring-field="plantingReportId"] option[value="phase3c-staff-report"]')).toHaveCount(1);

  await page.goto("/admin/survival-monitoring?role=admin");
  await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
  await expect(page.getByRole("button", { name: aggregateLabel, exact: true })).toHaveCount(0);
});

test("Monitor Permanent Sample Trees entry is a visible header action for Staff and Admin when the gate is enabled", async ({ page }) => {
  await isolate(page);
  await mockLegacyMonitoringApi(page);
  for (const role of ["staff", "admin"]) {
    await page.goto(`/${role}/survival-monitoring?role=${role}`);
    const entry = page.locator(".sm-header-actions").getByRole("link", { name: sampleTreeLabel, exact: true });
    await expect(entry).toBeVisible();
    await expect(entry).toHaveAttribute("href", `/${role}/permanent-sample-monitoring`);
    await expect(page.getByRole("link", { name: sampleTreeLabel, exact: true })).toHaveCount(1);
  }

  await page.goto("/staff/survival-monitoring?role=staff");
  await page.locator(".sm-header-actions").getByRole("link", { name: sampleTreeLabel, exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/permanent-sample-monitoring$/);
  await expectMonitoringPage(page);
});

test("disabled gate hides the Monitor Permanent Sample Trees entry but keeps aggregate monitoring", async ({ page }) => {
  await isolate(page, false);
  await mockLegacyMonitoringApi(page);
  for (const role of ["staff", "admin"]) {
    await page.goto(`/${role}/survival-monitoring?role=${role}`);
    await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
    await expect(page.getByRole("link", { name: sampleTreeLabel, includeHidden: true })).toHaveCount(0);
  }
  await page.goto("/staff/survival-monitoring?role=staff");
  await expect(page.getByRole("button", { name: aggregateLabel, exact: true })).toBeVisible();
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
      actions.getByRole("link", { name: sampleTreeLabel, exact: true }),
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
  await expect(page.getByRole("dialog",{name:"Monitor Planted Trees"}).getByRole("alert")).toContainText("A return reason is required");
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
  await expect(page.getByRole("dialog",{name:"Monitor Planted Trees"}).getByRole("alert")).toContainText("This monitoring visit changed.");
  await expect(page.getByText("Pending Admin Review · Revision 11")).toBeVisible();

  await page.goto("/admin/permanent-sample-monitoring?role=admin&fixture=review-failure");
  await page.getByRole("button", { name: "VPMV-PENDING-REVIEW-001" }).click();
  await page.getByRole("button", { name: "Approve Visit" }).click();
  await expect(page.getByRole("dialog",{name:"Monitor Planted Trees"}).getByRole("alert")).toContainText("Review service is unavailable.");
});
