import { expect, test } from "@playwright/test";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const allowed = new Set(["http://127.0.0.1:5186", "http://127.0.0.1:5185", "http://127.0.0.1:9299"]);
const fixture = () => readFile(path.join(os.tmpdir(), "menro-phase3c-browser-fixture.json"), "utf8").then(JSON.parse);
async function isolate(page) {
  const external = [];
  await page.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (allowed.has(origin)) return route.continue();
    external.push(origin); return route.abort();
  });
  return () => expect(external, "External requests blocked").toEqual([]);
}
async function login(page, role, destination) {
  const data = await fixture();
  await page.goto(destination);
  await expect(page.locator("#login-email")).toBeVisible({ timeout: 15000 });
  await page.locator("#login-email").fill(data.emails[role]);
  await page.locator("#login-password").fill(data.password);
  await page.locator("button.login-primary-btn").click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 20000 });
  return data;
}
async function open(page, role) {
  const data = await login(page, role, `/${role}/permanent-sample-monitoring`);
  await page.getByRole("button", { name: data.visitId, exact: true }).click({ timeout: 20000 });
  await expect(page.getByText("TREE-001").first()).toBeVisible();
  return data;
}
async function api(page, url, method = "GET", body, key) {
  return page.evaluate(async ({ url, method, body, key }) => {
    const { authenticatedFetch } = await import("/src/services/authenticatedApi.js");
    const response = await authenticatedFetch(url, { method,
      headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }, { url, method, body, key });
}
test.afterAll(async () => {
  if (process.env.MENRO_PHASE3C_FAKE_VIDEO_PATH) await rm(process.env.MENRO_PHASE3C_FAKE_VIDEO_PATH, { force: true });
});

test("real request → notification Answer This → requester reply, with privacy and idempotency", async ({ browser, page }) => {
  const checkStaff = await isolate(page);
  const data = await open(page, "staff");
  if (process.env.MENRO_READINESS_EVIDENCE_READ_ONLY_EXPECTED === "true") expect(data.evidenceWriteEnabled).toBe(false);
  const preflight = await page.request.fetch("http://127.0.0.1:5185/api/sample-monitoring-information", { method: "OPTIONS", headers: {
    Origin: "http://127.0.0.1:5186", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
  } });
  expect(preflight.status()).toBe(204);
  expect(preflight.headers()["access-control-allow-headers"].toLowerCase()).toContain("idempotency-key");
  await page.getByLabel("Question to the verified planting requester").fill("Is the access path usable?");
  const created = page.waitForResponse(response => response.url().endsWith("/api/sample-monitoring-information") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Request Information", exact: true }).click();
  const response = await created; expect(response.status()).toBe(200);
  const question = (await response.json()).data;
  const anonymous = await page.request.get(`http://127.0.0.1:5185/api/sample-monitoring-information/${question.id}`);
  expect(anonymous.status()).toBe(401);
  const original = response.request().headers()["idempotency-key"];
  expect((await api(page, "/sample-monitoring-information", "POST", { visitId: data.visitId, question: "Is the access path usable?" }, original)).body.data.id).toBe(question.id);
  expect((await api(page, "/sample-monitoring-information", "POST", { visitId: data.visitId, question: "Changed question" }, original)).status).toBe(409);

  const participant = await browser.newPage(); const checkParticipant = await isolate(participant);
  await login(participant, "participant", "/participant/monitoring-information");
  const notices = await api(participant, "/notifications");
  const notice = notices.body.data?.notifications?.find(row => row.relatedRecordId === question.id);
  expect(notice?.relatedRecordType, JSON.stringify(notices.body)).toBe("sampleMonitoringInformation");
  await participant.getByRole("button", { name: "Notifications", exact: true }).click();
  await participant.locator(".notification-item").filter({ hasText: "Monitoring information requested" }).click();
  await participant.getByRole("button", { name: "Answer This", exact: true }).click();
  await expect(participant.getByRole("dialog", { name: "Monitoring information reply" })).toBeVisible();
  expect((await api(participant, `/sample-monitoring-information/${question.id}/answer`, "POST", { answer: "Stale answer", expectedVersion: 1 }, "stale-answer")).status).toBe(409);
  expect((await api(participant, "/sample-monitoring-information/not-an-owned-record")).status).toBe(404);
  await participant.getByLabel("Your answer").fill("Yes, the path is usable.");
  const answerResponse = participant.waitForResponse(response => response.url().endsWith(`/api/sample-monitoring-information/${question.id}/answer`) && response.request().method() === "POST");
  await participant.getByRole("button", { name: "Send answer", exact: true }).click();
  const answered = await answerResponse;
  const answerKey = answered.request().headers()["idempotency-key"];
  expect((await api(participant, `/sample-monitoring-information/${question.id}/answer`, "POST", { answer: "Yes, the path is usable.", expectedVersion: 0 }, answerKey)).status).toBe(200);
  await expect(participant.getByRole("dialog").getByText("Reply: Yes, the path is usable.")).toBeVisible();
  expect((await api(participant, `/sample-monitoring-information/${question.id}/answer`, "POST", { answer: "Changed", expectedVersion: 0 }, "different")).status).toBe(409);
  expect((await api(participant, "/permanent-sample-analytics")).status).toBe(403);
  const deniedVisit = await api(participant, `/verified-sample-monitoring/visits/${data.visitId}`);
  expect(deniedVisit.status).toBe(403);
  expect(JSON.stringify(deniedVisit.body)).not.toMatch(/privateEvidence|objectName|uploadIntent/);
  await page.reload(); await page.getByRole("button", { name: data.visitId, exact: true }).click();
  await expect(page.getByText("Reply: Yes, the path is usable.")).toBeVisible();
  const nonOwner = await browser.newPage(); const checkOther = await isolate(nonOwner);
  await login(nonOwner, "otherStaff", "/staff/permanent-sample-monitoring");
  const denied = await api(nonOwner, `/sample-monitoring-information/${question.id}`);
  expect(denied.status).toBe(404); expect(JSON.stringify(denied.body)).not.toMatch(/question|answer|privateEvidence/);
  expect((await api(nonOwner, "/permanent-sample-analytics")).body.data.cohorts).toEqual([]);
  checkOther(); checkParticipant(); checkStaff(); await participant.close(); await nonOwner.close();
});

test("unanswered information never blocks approval; approved-only analytics preserve unresolved sample identity", async ({ browser, page }) => {
  const checkStaff = await isolate(page); const data = await open(page, "staff");
  const question = await api(page, "/sample-monitoring-information", "POST", { visitId: data.visitId, question: "Optional follow-up, no answer needed for review." }, "unanswered");
  expect(question.status).toBe(200);
  expect((await api(page, "/permanent-sample-analytics")).body.data.cohorts).toEqual([]);
  await page.getByLabel("Height (cm)").fill("120"); await page.getByLabel("Diameter (cm)").fill("4");
  const tree = page.getByRole("group", { name: "TREE-001" });
  await tree.getByLabel("Condition").selectOption("Needs Rechecking");
  await tree.getByLabel("Remarks").fill("Location requires investigation.");
  await page.getByRole("button", { name: "Save TREE-001 Draft" }).click();
  await expect(page.getByText(/DRAFT · version 1/)).toBeVisible();
  const stale = await api(page, `/verified-sample-monitoring/visits/${data.visitId}`, "PUT", { expectedVersion: 0, assessments: [], submit: false });
  expect(stale.status).toBe(409);
  await page.getByRole("button", { name: "Submit Visit", exact: true }).click();
  await expect(page.getByText(/PENDING_ADMIN_APPROVAL · version/)).toBeVisible();
  expect((await api(page, "/permanent-sample-analytics")).body.data.cohorts).toEqual([]);
  const admin = await browser.newPage(); const checkAdmin = await isolate(admin);
  await open(admin, "admin");
  expect((await api(admin, `/verified-sample-monitoring/visits/${data.visitId}/review`, "POST", { expectedVersion: 2, approve: "false" })).status).toBe(400);
  expect((await api(admin, `/verified-sample-monitoring/visits/${data.visitId}/review`, "POST", { expectedVersion: 2, approve: false, reasons: " " })).status).toBe(400);
  await expect(admin.getByText("Reply: Yes, the path is usable.")).toBeVisible();
  await admin.getByRole("button", { name: "Approve Visit", exact: true }).click();
  await expect(admin.getByText(/APPROVED · version/)).toBeVisible();
  expect((await api(page, `/sample-monitoring-information/${question.body.data.id}`)).body.data.status).toBe("OPEN");
  await admin.goto("/admin/permanent-sample-analytics");
  await expect(admin.getByRole("heading", { name: "Permanent Sample Monitoring Analytics" })).toBeVisible();
  await expect(admin.getByText("Unassessed: 0 · Unresolved: 1")).toBeVisible();
  const analytics = (await api(admin, "/permanent-sample-analytics")).body.data;
  const approved = await api(admin, "/verified-sample-monitoring/visits?status=APPROVED&limit=1");
  expect(approved.body.data.visits.map(row => row.id)).toEqual([data.visitId]);
  expect(analytics.cohorts).toHaveLength(1);
  expect(analytics.cohorts[0].latest.samples[0].sampleId).toBe("TREE-001");
  expect(analytics.cohorts[0].latest.counts.Dead).toBe(0);
  expect(JSON.stringify(analytics)).not.toMatch(/privateEvidence|objectName|uploadIntent/);
  await admin.getByLabel("Site", { exact: true }).selectOption(analytics.cohorts[0].siteId);
  await admin.getByLabel("Cohort", { exact: true }).selectOption(analytics.cohorts[0].cohortId);
  checkAdmin(); checkStaff(); await admin.close();
});

test("requester and owner inboxes expose older authorized requests through real cursor queries", async ({ browser, page }) => {
  const checkStaff = await isolate(page); const data = await open(page, "staff");
  for (let i = 0; i < 53; i++) {
    const response = await api(page, "/sample-monitoring-information", "POST", { visitId: data.visitId, question: `Pagination request ${i}` }, `pagination-${i}`);
    expect(response.status).toBe(200);
  }
  const participant = await browser.newPage(); const checkParticipant = await isolate(participant);
  await login(participant, "participant", "/participant/monitoring-information");
  await expect(participant.getByRole("button", { name: "Load older requests" })).toBeVisible({ timeout: 15000 });
  await expect(participant.getByText("Pagination request 0", { exact: true })).toHaveCount(0);
  await participant.getByRole("button", { name: "Load older requests" }).click();
  await expect(participant.getByText("Pagination request 0", { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: data.visitId, exact: true }).click();
  await page.getByRole("button", { name: "Load older requests" }).click();
  await expect(page.getByText("Pagination request 0", { exact: true })).toBeVisible();
  const filters = await api(page, "/permanent-sample-analytics/filters?limit=1");
  const approved = await api(page, "/verified-sample-monitoring/visits?status=APPROVED&limit=1");
  expect(approved.body.data.visits.map(row => row.id)).toEqual([data.visitId]);
  expect(filters.status).toBe(200); expect(filters.body.data.filters[0].cohortId).toBe(data.prefix + "-cohort");
  checkParticipant(); checkStaff(); await participant.close();
});
