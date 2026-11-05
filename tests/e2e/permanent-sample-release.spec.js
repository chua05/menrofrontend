import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const fixture = () => readFile(path.join(os.tmpdir(), "menro-phase3c-browser-fixture.json"), "utf8").then(JSON.parse);
const allowed = new Set(["http://127.0.0.1:5186", "http://127.0.0.1:5185", "http://127.0.0.1:9299"]);
async function login(page, role) {
  const external = [];
  await page.route("**/*", route => {
    const origin = new URL(route.request().url()).origin;
    if (allowed.has(origin)) return route.continue();
    external.push(origin); return route.abort();
  });
  const data = await fixture();
  await page.goto(role === "participant" ? "/participant/monitoring-information" : `/${role === "otherStaff" ? "staff" : role}/permanent-sample-monitoring`);
  await page.locator("#login-email").fill(data.emails[role]);
  await page.locator("#login-password").fill(data.password);
  await page.locator("button.login-primary-btn").click();
  await expect(page).toHaveURL(new RegExp(`/${role === "otherStaff" ? "staff" : role}/dashboard$`), { timeout: 20000 });
  await page.goto(role === "participant" ? "/participant/monitoring-information" : `/${role === "otherStaff" ? "staff" : role}/permanent-sample-monitoring`);
  return { data, check: () => expect(external).toEqual([]) };
}
async function api(page, url, method = "GET", body) {
  return page.evaluate(async ({ url, method, body }) => {
    const { authenticatedFetch } = await import("/src/services/authenticatedApi.js");
    const response = await authenticatedFetch(url, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": "release_negative_test" },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text();
    let value; try { value = JSON.parse(text); } catch { value = null; }
    return { status: response.status, body: value, bytes: text.length, type: response.headers.get("content-type") };
  }, { url, method, body });
}
test("paused real workflows preserve private history and reject mutations without changing ledgers", async ({ browser, page }) => {
  const { data, check } = await login(page, "staff"); expect(data.releaseAcceptance).toBe("paused");
  await page.getByRole("button", { name: data.visitId, exact: true }).click({ timeout: 20000 });
  await expect(page.getByText("Changes are paused.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /Save TREE|Submit Visit|Capture photo|Request Information/ })).toHaveCount(0);
  const base = `/verified-sample-monitoring/visits/${data.visitId}`;
  const detail = await api(page, base); expect(detail.status).toBe(200); expect(detail.body.data.writesPaused).toBe(true);
  const version = detail.body.data.version;
  const history = detail.body.data.sampleAssessments[0].evidenceHistory;
  expect(history).toHaveLength(1); expect(history[0].revision).toBe(0);
  const image = await api(page, `/evidence/sample-monitoring/visits/${data.visitId}/samples/TREE-001/evidence/0`);
  expect(image.status).toBe(200); expect(image.type).toContain("image/jpeg"); expect(image.bytes).toBeGreaterThan(0);
  expect(JSON.stringify(detail.body)).not.toMatch(/privateEvidence|objectName|uploadIntent/);
  const mutations = [
    [base, "PUT", { expectedVersion: version, assessments: [{ sampleId: "TREE-001", condition: "Healthy" }] }],
    ["/sample-monitoring-information", "POST", { visitId: data.visitId, question: "Paused question" }],
    ["/evidence-capture-sessions", "POST", { workflow: "sample-monitoring", visitId: data.visitId, cohortId: detail.body.data.cohortId,
      siteId: detail.body.data.siteId, sampleId: "TREE-001", samplingPlanVersion: 1, baselineVersion: 1, visitVersion: version, assessmentRevision: 0 }],
  ];
  for (const [url, method, body] of mutations) expect((await api(page, url, method, body)).status).toBe(503);
  const participant = await browser.newPage(); const requester = await login(participant, "participant");
  const question = await api(participant, `/sample-monitoring-information/${data.questionId}`); expect(question.status).toBe(200);
  expect((await api(participant, `/sample-monitoring-information/${data.answeredId}`)).body.data.answer).toBe("Historical fixture answer");
  expect((await api(participant, `/sample-monitoring-information/${data.questionId}/answer`, "POST", { expectedVersion: 0, answer: "Blocked" })).status).toBe(503);
  expect((await api(participant, base)).status).toBe(403);
  const admin = await browser.newPage(); const reviewer = await login(admin, "admin");
  expect((await api(admin, base)).status).toBe(200);
  expect((await api(admin, `${base}/review`, "POST", { expectedVersion: version, approve: false, reasons: "Paused return" })).status).toBe(503);
  expect((await api(admin, "/permanent-sample-analytics")).status).toBe(200);
  expect((await page.request.get(`http://127.0.0.1:5185/api${base}`)).status()).toBe(401);
  requester.check(); reviewer.check(); check(); await participant.close(); await admin.close();
});
test("pilot real Auth/API applies allowlists in addition to roles and preserves authorized reads", async ({ browser, page }) => {
  const { data, check } = await login(page, "staff"); expect(data.releaseAcceptance).toBe("pilot");
  await page.getByRole("button", { name: data.visitId, exact: true }).click({ timeout: 20000 });
  const list = await api(page, "/verified-sample-monitoring/visits?limit=1");
  expect(list.status).toBe(200); expect(list.body.data.visits.map(row => row.id)).toEqual([data.visitId]); expect(list.body.data.nextCursor).toBeNull();
  const detail = await api(page, `/verified-sample-monitoring/visits/${data.visitId}`); expect(detail.status).toBe(200);
  expect((await api(page, "/verified-planting-cohorts")).body.data.map(row => row.id)).toEqual([detail.body.data.cohortId]);
  const saved = await api(page, `/verified-sample-monitoring/visits/${data.visitId}`, "PUT", {
    expectedVersion: detail.body.data.version, assessments: [{ sampleId: "TREE-001", condition: "Healthy", heightCm: 120, diameterCm: 4, remarks: "Allowlisted draft" }],
  });
  expect(saved.status).toBe(200); expect(saved.body.data.sampleAssessments[0].evidenceHistory).toHaveLength(1);
  const outside = await api(page, "/verified-planting-cohorts/not-allowlisted"); expect(outside.status).toBe(404);
  expect(JSON.stringify(outside.body)).not.toMatch(/privateEvidence|objectName|uploadIntent/);
  const stranger = await browser.newPage(); const other = await login(stranger, "otherStaff");
  expect((await api(stranger, "/verified-sample-monitoring/visits")).status).toBe(403);
  expect((await api(stranger, "/permanent-sample-analytics")).status).toBe(403);
  const forged = await api(stranger, "/evidence-capture-sessions", "POST", { actorId: `${data.prefix}-staff`, actorRole: "staff",
    workflow: "sample-monitoring", cohortId: detail.body.data.cohortId, siteId: detail.body.data.siteId, visitId: data.visitId,
    sampleId: "TREE-001", samplingPlanVersion: 1, baselineVersion: 1, visitVersion: detail.body.data.version, assessmentRevision: 0 });
  expect(forged.status).toBe(403);
  const admin = await browser.newPage(); const reviewer = await login(admin, "admin");
  expect((await api(admin, "/verified-sample-monitoring/visits")).body.data.visits.map(row => row.id)).toEqual([data.visitId]);
  const participant = await browser.newPage(); const requester = await login(participant, "participant");
  expect((await api(participant, `/sample-monitoring-information/${data.questionId}`)).status).toBe(200);
  expect((await api(participant, `/verified-sample-monitoring/visits/${data.visitId}`)).status).toBe(403);
  other.check(); reviewer.check(); requester.check(); check(); await stranger.close(); await admin.close(); await participant.close();
});
