import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { AMBIGUOUS_WRITE_MESSAGE, READ_TIMEOUT_MESSAGE, RequestTimeoutError, fetchJsonWithDeadline, isAmbiguousWriteFailure, withDeadline } from "../src/utils/requestTimeout.js";
import { findReconciledSubmission, ownSubmissionIdsForEvent } from "../src/utils/plantingSubmissionReconcile.js";

// A server that accepts requests and never answers (or answers only headers).
async function withStallingServer(run, { headersOnly = false } = {}) {
  const received = [];
  const sockets = new Set();
  const server = createServer((request, response) => {
    received.push(request.method);
    request.resume();
    if (headersOnly) { response.writeHead(200, { "Content-Type": "application/json" }); response.write("{\"success\":"); }
  });
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try { return await run(`http://127.0.0.1:${server.address().port}/api`, received); }
  finally { sockets.forEach(socket => socket.destroy()); await new Promise(resolve => server.close(resolve)); }
}

test("withDeadline rejects a promise that never settles and clears its timer on success", async () => {
  await assert.rejects(withDeadline(new Promise(() => {}), 20, () => new RequestTimeoutError("late")), { message: "late", code: "REQUEST_TIMEOUT" });
  let cleared = false;
  assert.equal(await withDeadline(Promise.resolve(7), 1000, () => new Error("no"), { clearTimer: timer => { cleared = true; clearTimeout(timer); } }), 7);
  assert.ok(cleared);
});

test("a stalled read recovers with a retryable, non-ambiguous error", async () => {
  await withStallingServer(async url => {
    const started = Date.now();
    await assert.rejects(fetchJsonWithDeadline(`${url}/planting-reports`, {}, { timeoutMs: 80 }), error => {
      assert.equal(error.message, READ_TIMEOUT_MESSAGE);
      assert.equal(isAmbiguousWriteFailure(error), false);
      return true;
    });
    assert.ok(Date.now() - started < 2000);
  });
});

test("a stalled write that reached the server is reported as ambiguous", async () => {
  await withStallingServer(async (url, received) => {
    await assert.rejects(fetchJsonWithDeadline(`${url}/planting-reports/official`, { method: "POST", body: "{}" }, { timeoutMs: 80 }), error => {
      assert.equal(error.message, AMBIGUOUS_WRITE_MESSAGE);
      assert.equal(isAmbiguousWriteFailure(error), true);
      return true;
    });
    assert.deepEqual(received, ["POST"]);
  });
});

test("a response whose body stalls mid-stream is also bounded", async () => {
  await withStallingServer(async url => {
    await assert.rejects(fetchJsonWithDeadline(`${url}/planting-reports`, {}, { timeoutMs: 80, parse: response => response.json() }), { message: READ_TIMEOUT_MESSAGE });
  }, { headersOnly: true });
});

test("a refused connection on a write is ambiguous; on a read it is a plain retryable error", async () => {
  const server = createServer(); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`; await new Promise(resolve => server.close(resolve));
  await assert.rejects(fetchJsonWithDeadline(url, { method: "PUT", body: "{}" }, { timeoutMs: 2000 }), error => isAmbiguousWriteFailure(error));
  await assert.rejects(fetchJsonWithDeadline(url, {}, { timeoutMs: 2000 }), error => !isAmbiguousWriteFailure(error) && /could not be reached/.test(error.message));
});

const records = [
  { id: "event_EV1", eventId: "EV1", submissions: [{ id: "old-returned", contributorId: "p1", staffReviewStatus: "Rejected" }] },
  { id: "event_EV2", eventId: "EV2", submissions: [{ id: "other-event", contributorId: "p1", staffReviewStatus: "Pending Review" }] },
];

test("reconciliation finds only a new pending submission by the same participant for the same event", () => {
  const known = ownSubmissionIdsForEvent(records, "EV1");
  assert.deepEqual(known, ["old-returned"]);
  const pending = { eventId: "EV1", knownSubmissionIds: known, contributorId: "p1" };
  assert.equal(findReconciledSubmission(records, pending), null, "nothing new: the earlier attempt was not saved");
  const after = [{ ...records[0], submissions: [...records[0].submissions,
    { id: "someone-else", contributorId: "p2", staffReviewStatus: "Pending Review" },
    { id: "saved-now", contributorId: "p1", staffReviewStatus: "Pending Review" }] }, records[1]];
  assert.equal(findReconciledSubmission(after, pending)?.id, "saved-now");
  assert.equal(findReconciledSubmission(after, { ...pending, eventId: "EV3" }), null);
});

test("a refusal is explained by the participant's own pending report for the event, not a changed balance", async () => {
  const { findOwnPendingSubmission } = await import("../src/utils/plantingSubmissionReconcile.js");
  const rows = [{ id: "event_EV1", eventId: "EV1", submissions: [
    { id: "returned", contributorId: "p1", staffReviewStatus: "Rejected" },
    { id: "other", contributorId: "p2", staffReviewStatus: "Pending Review" }] }];
  assert.equal(findOwnPendingSubmission(rows, { eventId: "EV1", contributorId: "p1" }), null, "a genuine balance refusal stays as it is");
  rows[0].submissions.push({ id: "saved", contributorId: "p1", staffReviewStatus: "Pending Review" });
  assert.equal(findOwnPendingSubmission(rows, { eventId: "EV1", contributorId: "p1" })?.id, "saved");
  assert.equal(findOwnPendingSubmission(rows, { eventId: "EV1", contributorId: "" }), null);
});

test("an unconfirmed submission is kept per user and role until it is resolved", async () => {
  const { clearPendingSubmission, loadPendingSubmission, savePendingSubmission } = await import("../src/utils/pendingPlantingSubmission.js");
  const store = new Map();
  globalThis.window = { sessionStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) } };
  try {
    savePendingSubmission("staff", "s1", { body: { requestId: "REQ-1", clientSubmissionId: "key-1" } });
    assert.equal(loadPendingSubmission("staff", "s1").body.clientSubmissionId, "key-1");
    assert.equal(loadPendingSubmission("staff", "s2"), null, "another user never sees it");
    assert.equal(loadPendingSubmission("participant", "s1"), null, "another role never sees it");
    clearPendingSubmission("staff", "s1");
    assert.equal(loadPendingSubmission("staff", "s1"), null);
    // Blocked storage falls back to memory for the life of the page.
    globalThis.window = { get sessionStorage() { throw new Error("blocked"); } };
    savePendingSubmission("participant", "p1", { eventId: "EV1", knownSubmissionIds: [] });
    assert.equal(loadPendingSubmission("participant", "p1").eventId, "EV1");
    clearPendingSubmission("participant", "p1");
    assert.equal(loadPendingSubmission("participant", "p1"), null);
    savePendingSubmission("staff", "", { body: {} });
    assert.equal(loadPendingSubmission("staff", ""), null, "nothing is kept without a signed-in user");
  } finally { delete globalThis.window; }
});

test("a gateway 502/504 on a write is ambiguous; MENRO's own answers are not", async () => {
  const { isGatewayWriteFailure } = await import("../src/utils/requestTimeout.js");
  const server = createServer((request, response) => {
    request.resume();
    if (request.url.endsWith("/gateway")) { response.writeHead(504, { "Content-Type": "text/html" }); response.end("<html>Gateway Timeout</html>"); return; }
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ success: false, message: "Private planting evidence storage is unavailable." }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await assert.rejects(fetchJsonWithDeadline(`${base}/gateway`, { method: "PUT", body: "{}" }, { timeoutMs: 2000 }), error => isAmbiguousWriteFailure(error) && error.message === AMBIGUOUS_WRITE_MESSAGE);
    const read = await fetchJsonWithDeadline(`${base}/gateway`, {}, { timeoutMs: 2000 });
    assert.equal(read.response.status, 504, "a read is never ambiguous");
    const refused = await fetchJsonWithDeadline(`${base}/storage`, { method: "PUT", body: "{}" }, { timeoutMs: 2000 });
    assert.equal(refused.response.status, 503, "MENRO's own 503 is a definitive answer");
  } finally { await new Promise(resolve => server.close(resolve)); }
  assert.equal(isGatewayWriteFailure("POST", 502, { success: false, message: "Unable to send" }), false);
  assert.equal(isGatewayWriteFailure("POST", 500, null), false);
});

test("MENRO 503 reasons are shown; other server failures stay generic", async () => {
  const { serverFailureMessage } = await import("../src/utils/requestTimeout.js");
  assert.equal(serverFailureMessage(503, { message: "Evidence uploads are temporarily unavailable. Please try again later." }, "generic"), "Evidence uploads are temporarily unavailable. Please try again later.");
  assert.equal(serverFailureMessage(503, null, "generic"), "generic");
  assert.equal(serverFailureMessage(500, { message: "stack details" }, "generic"), "generic");
  assert.equal(serverFailureMessage(409, { message: "The reportable balance changed." }, "generic"), "The reportable balance changed.");
});
