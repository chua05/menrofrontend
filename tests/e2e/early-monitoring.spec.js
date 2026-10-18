import { test, expect } from "@playwright/test";
import path from "node:path";
import { formatDisplayId } from "../../src/utils/displayId.js";

const PASSWORD = "Phase2-Test-Only!2026";
const EVIDENCE_ROOT = "C:/Users/chuak/Desktop/menrobackend/tests/integration/fixtures";
const EMAILS = {
  participant: "phase2.participant@example.test",
  staff: "phase2.staff@example.test",
  admin: "phase2.admin@example.test",
};

async function login(page, role) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(EMAILS[role]);
  await page.locator("#login-password").fill(PASSWORD);
  await page.locator("button.login-primary-btn").click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await page.goto(`/${role}/survival-monitoring`);
  await expect(page.getByRole("heading", { name: "Survival Monitoring" })).toBeVisible();
}

function row(page, reportNumber) {
  return page.locator("tbody tr").filter({ hasText: formatDisplayId("RPT", reportNumber) });
}

async function submit(page, reportId, evidenceName, monitoredDate, type = "early") {
  await page.getByRole("button", { name: "Monitor Planted Trees" }).click();
  const modal = page.locator(".sm-modal");
  await modal.locator("select").first().selectOption(reportId);
  if (type === "early") {
    await modal.locator('.sm-form-section:has-text("Monitoring Type") select').selectOption("early");
    await expect(modal.getByText(/on-time deadline/i)).toBeVisible();
  }
  await modal.locator('input[type="date"]').fill(monitoredDate);
  await modal.locator('[data-monitoring-field="totalChecked"]').fill("10");
  await modal.locator('[data-monitoring-field="healthy"]').fill("8");
  await modal.locator('[data-monitoring-field="damaged"]').fill("1");
  await modal.locator('[data-monitoring-field="dead"]').fill("1");
  await modal.locator('input[type="file"]').last().setInputFiles(path.join(EVIDENCE_ROOT, evidenceName));
  await expect(modal.getByText("Photo GPS found")).toBeVisible();
  await modal.getByRole("button", { name: "Submit Monitoring Record" }).click();
  await expect(page.getByText("Your monitoring record was submitted successfully.")).toBeVisible({ timeout: 20_000 });
  await modal.locator(".sm-modal-close").click();
}

async function action(page, reportNumber, label, reason) {
  const record = row(page, reportNumber);
  await expect(record).toHaveCount(1);
  await record.getByTitle("View monitoring record").click();
  await expect(page.getByRole("heading", { name: "Survival Monitoring Details" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept(reason));
  await page.getByRole("button", { name: label, exact: true }).click();
  const message = { Review: "Monitoring observation reviewed.",
    "Return for Rechecking": "Observation returned for rechecking.",
    Approve: "Monitoring observation approved." }[label];
  await expect(page.getByText(message)).toBeVisible({ timeout: 20_000 });
}

test.describe.serial("Early Survival Monitoring authenticated acceptance", () => {
  test("Participant submits Early, Staff reviews, and Admin approves without official KPI impact", async ({ browser }) => {
    const participant = await browser.newPage();
    await login(participant, "participant");
    await submit(participant, "early-e2e-report-a", "early-a.jpg", "2026-10-01");
    await expect(row(participant, "TEST-EARLY-A")).toContainText("Early: Submitted");
    await participant.context().close();

    const staff = await browser.newPage();
    await login(staff, "staff");
    await action(staff, "TEST-EARLY-A", "Review");
    await staff.context().close();

    const admin = await browser.newPage();
    await login(admin, "admin");
    const before = await admin.getByText("Approved Full Cohorts", { exact: true }).locator("..").locator(".sm-kpi-value").innerText();
    await action(admin, "TEST-EARLY-A", "Approve");
    await admin.reload();
    await expect(admin.getByText("Approved Full Cohorts", { exact: true }).locator("..").locator(".sm-kpi-value")).toHaveText(before);
    await admin.context().close();
  });

  test("Staff return and participant correction preserve the same Early observation", async ({ browser }) => {
    const participant = await browser.newPage();
    await login(participant, "participant");
    await submit(participant, "early-e2e-report-b", "early-b-initial.jpg", "2026-10-01");
    await participant.context().close();

    const staff = await browser.newPage();
    await login(staff, "staff");
    await action(staff, "TEST-EARLY-B", "Return for Rechecking", "Correct the early observation.");
    await staff.context().close();

    const correction = await browser.newPage();
    await login(correction, "participant");
    const record = row(correction, "TEST-EARLY-B");
    await record.getByTitle("View monitoring record").click();
    await correction.getByRole("button", { name: "Edit and Resubmit" }).click();
    const modal = correction.locator(".sm-modal");
    await expect(modal.getByRole("heading", { name: "Edit Returned Monitoring Observation" })).toBeVisible();
    await modal.locator('input[type="date"]').fill("2026-10-02");
    await modal.locator('input[type="file"]').last().setInputFiles(path.join(EVIDENCE_ROOT, "early-b-replacement.jpg"));
    await modal.getByRole("button", { name: "Submit Monitoring Record" }).click();
    await expect(correction.getByText("Monitoring observation resubmitted for review.")).toBeVisible({ timeout: 20_000 });
    await modal.locator(".sm-modal-close").click();
    await row(correction, "TEST-EARLY-B").getByTitle("View monitoring record").click();
    await expect(correction.getByText("Revision history: Revision 1, Revision 2")).toBeVisible();
    await expect(correction.getByText("Early Monitoring Entry 1")).toBeVisible();
    await correction.context().close();
  });

  test("Official submission remains available while an Early observation is unresolved", async ({ browser }) => {
    const participant = await browser.newPage();
    await login(participant, "participant");
    await participant.getByPlaceholder("Search monitoring records...").fill("early-e2e-report-c");
    await expect(row(participant, "TEST-EARLY-C")).toContainText("Early: Submitted");
    await participant.getByPlaceholder("Search monitoring records...").fill("");
    await submit(participant, "early-e2e-report-c", "valid-official-current.jpg", "2026-10-15", "official");
    await participant.getByPlaceholder("Search monitoring records...").fill("early-e2e-report-c");
    await row(participant, "TEST-EARLY-C").getByTitle("View monitoring record").click();
    await expect(participant.getByText("Early Monitoring Entry 1")).toBeVisible();
    await expect(participant.getByText("Official Monitoring Entry 2")).toBeVisible();
    await participant.context().close();
  });
});
