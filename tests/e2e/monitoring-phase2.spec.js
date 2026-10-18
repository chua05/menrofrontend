import { test, expect } from "@playwright/test";
import path from "node:path";
import { formatDisplayId } from "../../src/utils/displayId.js";

const PASSWORD = "Phase2-Test-Only!2026";
const EVIDENCE_ROOT = "C:/Users/chuak/Desktop/menrobackend/tests/integration/fixtures";
const ROLE_EMAILS = {
  participant: "phase2.participant@example.test",
  other: "phase2.other@example.test",
  staff: "phase2.staff@example.test",
  admin: "phase2.admin@example.test",
};
const EVIDENCE_DATES = {
  "valid-original.jpg": "2026-10-01",
  "outside-site.jpg": "2026-10-01",
  "valid-replacement.jpg": "2026-10-02",
  "valid-third.jpg": "2026-10-03",
  "valid-fourth.jpg": "2026-10-04",
};

async function login(page, role) {
  const authFailures = [];
  const apiResponses = [];
  page.on("response", async (response) => {
    if (response.url().includes("identitytoolkit") && response.status() >= 400) {
      authFailures.push({ url: response.url(), status: response.status(), body: await response.text() });
    }
    if (response.url().startsWith("http://localhost:5000/api/")) {
      apiResponses.push({ url: response.url(), status: response.status() });
    }
  });
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ROLE_EMAILS[role]);
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator("button.login-primary-btn").click();
  try {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  } catch (error) {
    const pageText = (await page.locator("body").innerText()).slice(0, 1_000);
    throw new Error(`Login did not leave /login. Auth failures: ${JSON.stringify(authFailures)}. API responses: ${JSON.stringify(apiResponses)}. Page: ${JSON.stringify(pageText)}`, { cause: error });
  }
}

async function openMonitoring(page, role) {
  await page.goto(`/${role}/survival-monitoring`);
  await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
}

async function submitObservation(page, reportId, evidenceName, counts = { total: 10, healthy: 8, damaged: 1, dead: 1 }) {
  await page.getByRole("button", { name: "Monitor Planted Trees" }).click();
  const modal = page.locator(".sm-modal");
  await expect(modal).toBeVisible();
  await modal.locator("select").first().selectOption(reportId);
  await modal.locator('input[type="date"]').fill(EVIDENCE_DATES[evidenceName]);
  await modal.locator('[data-monitoring-field="totalChecked"]').fill(String(counts.total));
  await modal.locator('[data-monitoring-field="healthy"]').fill(String(counts.healthy));
  await modal.locator('[data-monitoring-field="damaged"]').fill(String(counts.damaged));
  await modal.locator('[data-monitoring-field="dead"]').fill(String(counts.dead));
  await modal.locator('input[type="file"]').last().setInputFiles(path.join(EVIDENCE_ROOT, evidenceName));
  await expect(modal.getByText("Photo GPS found")).toBeVisible();
  await modal.getByRole("button", { name: "Submit Monitoring Record" }).click();
  await expect(page.getByText("Your monitoring record was submitted successfully.")).toBeVisible({ timeout: 20_000 });
  await modal.locator(".sm-modal-close").click();
}

function recordRow(page, reportNumber) {
  return page.locator("tbody tr").filter({ hasText: formatDisplayId("RPT", reportNumber) });
}

async function openRecord(page, reportNumber) {
  const row = recordRow(page, reportNumber);
  await expect(row).toHaveCount(1);
  await row.getByTitle("View monitoring record").click();
  await expect(page.getByRole("heading", { name: "Survival Monitoring Details" })).toBeVisible();
}

async function performAction(page, reportNumber, action, reason) {
  await openRecord(page, reportNumber);
  page.once("dialog", (dialog) => dialog.accept(reason));
  await page.getByRole("button", { name: action, exact: true }).click();
  const messages = {
    Review: "Monitoring observation reviewed.",
    "Return for Rechecking": "Observation returned for rechecking.",
    Approve: "Monitoring observation approved.",
    Reject: "Monitoring observation rejected.",
  };
  await expect(page.getByText(messages[action])).toBeVisible({ timeout: 20_000 });
}

async function resubmitReturnedObservation(page, reportNumber, evidenceName) {
  await openRecord(page, reportNumber);
  await page.getByRole("button", { name: "Edit and Resubmit" }).click();
  const modal = page.locator(".sm-modal");
  await expect(modal.getByRole("heading", { name: "Edit Returned Monitoring Observation" })).toBeVisible();
  await modal.locator('input[type="date"]').fill(EVIDENCE_DATES[evidenceName]);
  await modal.locator('[data-monitoring-field="totalChecked"]').fill("5");
  await modal.locator('[data-monitoring-field="healthy"]').fill("3");
  await modal.locator('[data-monitoring-field="damaged"]').fill("1");
  await modal.locator('[data-monitoring-field="dead"]').fill("1");
  await modal.locator('input[type="file"]').last().setInputFiles(path.join(EVIDENCE_ROOT, evidenceName));
  await expect(modal.getByText("Photo GPS found")).toBeVisible();
  await modal.getByRole("button", { name: "Submit Monitoring Record" }).click();
  await expect(page.getByText("Monitoring observation resubmitted for review.")).toBeVisible({ timeout: 20_000 });
  await modal.locator(".sm-modal-close").click();
}

test.describe.serial("Monitoring Phase 2 authenticated workflows", () => {
  test("A: participant submits, Staff reviews, and Admin approves", async ({ browser }) => {
    const participant = await browser.newPage();
    await login(participant, "participant");
    await openMonitoring(participant, "participant");
    await submitObservation(participant, "phase2-report-a", "valid-original.jpg");
    await expect(recordRow(participant, "TEST-PHASE2-A")).toHaveCount(1);
    await participant.context().close();

    const staff = await browser.newPage();
    await login(staff, "staff");
    await openMonitoring(staff, "staff");
    await performAction(staff, "TEST-PHASE2-A", "Review");
    await expect(staff.getByText("Reviewed", { exact: true })).toBeVisible();
    await staff.context().close();

    const admin = await browser.newPage();
    await login(admin, "admin");
    await openMonitoring(admin, "admin");
    await performAction(admin, "TEST-PHASE2-A", "Approve");
    await expect(admin.getByText("Approved", { exact: true })).toBeVisible();
    await expect(admin.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
    await expect(admin.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
    await admin.reload();
    const officialKpi = admin.getByText("Approved Full Cohorts", { exact: true }).locator("..");
    await expect(officialKpi.locator(".sm-kpi-value")).toHaveText("3");
    await admin.goto("/admin/dashboard");
    const dashboardSurvival = admin.getByText("Survival Rate (All Sites)", { exact: true }).locator("../..");
    await expect(dashboardSurvival.locator(".dashboard-kpi-value")).toHaveText("90%");
    await admin.context().close();
  });

  test("B and E: Staff returns, participant replaces evidence and resubmits, then Admin approves", async ({ browser }) => {
    const participant = await browser.newPage();
    await login(participant, "participant");
    await openMonitoring(participant, "participant");
    await submitObservation(participant, "phase2-report-b", "outside-site.jpg");
    await participant.context().close();

    const staffReturn = await browser.newPage();
    await login(staffReturn, "staff");
    await openMonitoring(staffReturn, "staff");
    await performAction(staffReturn, "TEST-PHASE2-B", "Return for Rechecking", "Replace the out-of-site evidence.");
    await expect(staffReturn.getByText("Returned for Rechecking", { exact: true })).toBeVisible();
    await staffReturn.context().close();

    const correction = await browser.newPage();
    await login(correction, "participant");
    await openMonitoring(correction, "participant");
    await resubmitReturnedObservation(correction, "TEST-PHASE2-B", "valid-replacement.jpg");
    await openRecord(correction, "TEST-PHASE2-B");
    await expect(correction.getByText("Revision history: Revision 1, Revision 2")).toBeVisible();
    await expect(correction.getByAltText(/Monitoring evidence/)).toBeVisible();
    await correction.context().close();

    const staffReview = await browser.newPage();
    await login(staffReview, "staff");
    await openMonitoring(staffReview, "staff");
    await performAction(staffReview, "TEST-PHASE2-B", "Review");
    await staffReview.context().close();

    const admin = await browser.newPage();
    await login(admin, "admin");
    await openMonitoring(admin, "admin");
    await performAction(admin, "TEST-PHASE2-B", "Approve");
    await expect(admin.getByText("Approved", { exact: true })).toBeVisible();
    await admin.context().close();
  });

  test("C: Admin rejection permits a new observation while preserving the rejected one", async ({ browser }) => {
    const participant = await browser.newPage();
    await login(participant, "participant");
    await openMonitoring(participant, "participant");
    await submitObservation(participant, "phase2-report-c", "valid-third.jpg");
    await participant.context().close();

    const staff = await browser.newPage();
    await login(staff, "staff");
    await openMonitoring(staff, "staff");
    await performAction(staff, "TEST-PHASE2-C", "Review");
    await staff.context().close();

    const admin = await browser.newPage();
    await login(admin, "admin");
    await openMonitoring(admin, "admin");
    await performAction(admin, "TEST-PHASE2-C", "Reject", "Counts require a new field observation.");
    await expect(admin.getByText("Rejected", { exact: true })).toBeVisible();
    await admin.context().close();

    const replacement = await browser.newPage();
    await login(replacement, "participant");
    await openMonitoring(replacement, "participant");
    await submitObservation(replacement, "phase2-report-c", "valid-fourth.jpg");
    await openRecord(replacement, "TEST-PHASE2-C");
    await expect(replacement.getByText("Rejected", { exact: true })).toBeVisible();
    await expect(replacement.getByText("Pending Review", { exact: true })).toBeVisible();
    await replacement.context().close();
  });

  test("D: emulator identities reach only their protected role monitoring route", async ({ browser }) => {
    for (const role of ["participant", "staff", "admin"]) {
      const page = await browser.newPage();
      await login(page, role);
      await openMonitoring(page, role);
      await page.goto(role === "participant" ? "/admin/survival-monitoring" : "/participant/survival-monitoring");
      await expect(page).not.toHaveURL(role === "participant" ? /\/admin\/survival-monitoring/ : /\/participant\/survival-monitoring/);
      await page.context().close();
    }
  });
});
