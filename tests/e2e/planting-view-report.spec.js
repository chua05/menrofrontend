import { expect, test } from "@playwright/test";

// Requires backend fixtures: `node tests/integration/seedPlantingViewReportBrowserAcceptance.js`
// (menrobackend) which releases Narra x25 + Mahogany x15 and saves one real
// geotagged final Planting Report covering both types (Narra 10 planted + 15
// leftovers with a reason, Mahogany 15 planted). The two tests run in order:
// Staff forwards the final report, then Admin approves it -> Completed.
const FRONTEND = "http://127.0.0.1:5173";
const PASSWORD = "Planting-View-Browser!2026";
const SITE = "View Report Browser Site";
const KPI_KEYS = ["total", "awaiting", "pendingReview", "pendingApproval", "returned", "completed"];

test.describe.configure({ mode: "serial" });

async function login(page, role, email) {
  await page.goto(`${FRONTEND}/login`);
  await page.getByLabel("Email Address").fill(email);
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator(".login-primary-btn").click();
  await expect(page).toHaveURL(new RegExp(`/${role}/`));
}

async function readKpis(page) {
  const values = {};
  for (const key of KPI_KEYS) {
    values[key] = Number(await page.locator(`[data-kpi="${key}"] .pr-kpi-value`).innerText());
  }
  return values;
}

// KPI cards must equal what the table rows show (All Status filter, no search).
async function expectKpisMatchTable(page) {
  const rows = page.locator("table.pr-table tbody tr");
  // A report can sit in several queues; data-review-stages lists all of them.
  const inStage = (...stages) => rows.locator(stages.map((stage) => `.pr-review-line[data-review-stages*="${stage}"]`).join(", ")).count();
  await expect.poll(async () => {
    const kpis = await readKpis(page);
    const table = {
      total: await rows.count(),
      awaiting: await rows.locator(".pr-status-badge", { hasText: /^Awaiting Submission$/ }).count(),
      pendingReview: await inStage("Pending Review"),
      pendingApproval: await inStage("Reviewed", "Pending Admin Approval"),
      returned: await inStage("Returned for Correction"),
      completed: await rows.locator(`.pr-review-line[data-review-status="Completed"]`).count(),
    };
    return JSON.stringify(kpis) === JSON.stringify(table) ? "match" : `kpis ${JSON.stringify(kpis)} vs table ${JSON.stringify(table)}`;
  }, { timeout: 20_000 }).toBe("match");
  return readKpis(page);
}

// Each status filter shows exactly the rows its KPI card counts.
async function expectFiltersMatchKpis(page, kpis) {
  const select = page.locator(".pr-filter-wrap select");
  const rows = page.locator("table.pr-table tbody tr");
  for (const [key, expected] of Object.entries({ awaiting: kpis.awaiting, pendingReview: kpis.pendingReview,
    pendingApproval: kpis.pendingApproval, returned: kpis.returned, completed: kpis.completed })) {
    await select.selectOption(key);
    await expect(rows, `filter ${key}`).toHaveCount(expected);
  }
  await select.selectOption("All");
}

async function expectCompactCards(page) {
  const cards = page.locator(".pr-kpi-card");
  await expect(cards).toHaveCount(6);
  await expect(cards.locator(".pr-kpi-title")).toHaveText([
    "Total Reports", "Awaiting Submission", "Pending Review", "Pending Approval", "Returned for Correction", "Completed"]);
  await expect(cards.locator("svg")).toHaveCount(0);
  const boxes = await cards.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
  for (const box of boxes) {
    expect(Math.abs(box.width - boxes[0].width)).toBeLessThan(1.5);
    expect(Math.abs(box.height - boxes[0].height)).toBeLessThan(1.5);
  }
}

async function expectRow(page, reviewStatus) {
  const row = page.locator("tr", { hasText: SITE });
  await expect(row).toHaveCount(1, { timeout: 20_000 });
  await expect(row.locator(".pr-status-badge")).toHaveText("Submitted");
  await expect(row.locator(".pr-status-badge")).toHaveClass(/pr-status-approved/);
  await expect(row.locator(".pr-review-line")).toHaveText(`Review Status: ${reviewStatus}`);
  await expect(row).not.toContainText("Partial");
  await expect(row.locator(".pr-seedling-item")).toHaveText([/^Narra\s*25$/, /^Mahogany\s*15$/]);
  return row;
}

async function decide(page, role, startStatus, buttonName, confirmName, endStatus) {
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  await page.goto(`${FRONTEND}/${role}/planting-reports`);
  await expectRow(page, startStatus);
  await expectCompactCards(page);
  const before = await expectKpisMatchTable(page);
  await expectFiltersMatchKpis(page, before);

  const row = await expectRow(page, startStatus);
  await row.getByRole("button", { name: /^View / }).click();
  const drawer = page.getByRole("dialog", { name: /Planting report/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.locator(".pr-drawer-heading-meta .pr-status-badge")).toHaveText(["Submitted", startStatus]);
  // One final report = one row per seedling type, decided together.
  const submission = drawer.locator(".pr-submission-item");
  await expect(submission).toHaveCount(2);
  await expect(submission.first()).toContainText("Browser Planter");
  await expect(submission.first()).toContainText("Narra");
  await expect(submission.first()).toContainText("Seedlings damaged in transport");
  await expect(submission.nth(1)).toContainText("Mahogany");
  await expect(submission.first().locator(".pr-final-group-note")).toContainText("2 seedling types are reviewed together");
  await expect(drawer.getByRole("button", { name: buttonName, exact: true })).toHaveCount(1);
  const image = drawer.locator("img.pr-drawer-photo").first();
  await expect(image).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(drawer.locator(".pr-evidence-map-section .pr-location-map-legend")).toContainText(/(Verified|Unverified) \(1\)/);

  await submission.first().getByRole("button", { name: buttonName, exact: true }).click();
  const modal = page.locator(".pr-decision-modal");
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: confirmName }).click();
  await expect(modal).toBeHidden({ timeout: 20_000 });
  await expect(drawer.locator(".pr-drawer-heading-meta .pr-status-badge")).toHaveText(["Submitted", endStatus]);
  await drawer.locator(".pr-drawer-close").click();

  // Refreshed list (no page reload yet) already reflects the decision.
  await expectRow(page, endStatus);
  const after = await expectKpisMatchTable(page);
  expect(after.total).toBe(before.total);
  expect(after.awaiting).toBe(before.awaiting);
  await expectFiltersMatchKpis(page, after);
  return { before, problems };
}

test("staff sees KPI cards and table from saved data, and Forward to Admin updates them", async ({ page }) => {
  await login(page, "staff", "planting-view.staff@example.test");
  const { before, problems } = await decide(page, "staff", "Pending Review", "Forward to Admin", "Forward to Admin", "Reviewed");
  await page.reload();
  await expectRow(page, "Reviewed");
  const after = await expectKpisMatchTable(page);
  expect(after.pendingReview).toBe(before.pendingReview - 1);
  expect(after.pendingApproval).toBe(before.pendingApproval + 1);
  expect(problems).toEqual([]);
});

test("admin approval of the final report marks it Completed, leftovers included", async ({ page }) => {
  await login(page, "admin", "planting-view.admin@example.test");
  const { before, problems } = await decide(page, "admin", "Reviewed", "Approve", "Approve Report", "Completed");
  await page.reload();
  const row = await expectRow(page, "Completed");
  await expect(row).toContainText("25 reported planted / 40 released");
  const after = await expectKpisMatchTable(page);
  expect(after.pendingApproval).toBe(before.pendingApproval - 1);
  expect(after.completed).toBe(before.completed + 1);
  const select = page.locator(".pr-filter-wrap select");
  await select.selectOption("completed");
  await expect(page.locator("tr", { hasText: SITE })).toHaveCount(1);
  await select.selectOption("awaitingRemaining");
  await expect(page.locator("tr", { hasText: SITE })).toHaveCount(0);
  expect(problems).toEqual([]);
});
