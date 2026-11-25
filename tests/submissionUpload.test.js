import assert from "node:assert/strict";
import test from "node:test";
import { RequestTimeoutError, isAmbiguousWriteFailure } from "../src/utils/requestTimeout.js";
import { PROCESSING_MESSAGE, UploadNotCompletedError, findUnreadableFile, isEvidenceStillProcessing, sendSubmissionUpload } from "../src/utils/submissionUpload.js";

// Minimal XMLHttpRequest double driven by each test; timers are manual so limits are checked without waiting.
function setup() {
  const xhr = { upload: {}, headers: {}, status: 0, responseText: "", aborted: 0,
    open(method, url) { xhr.method = method; xhr.url = url; }, setRequestHeader(name, value) { xhr.headers[name] = value; },
    send(body) { xhr.body = body; }, abort() { xhr.aborted++; xhr.onabort?.(); } };
  const timers = new Map(); let next = 1;
  const setTimer = (fn, ms) => { timers.set(next, { fn, ms }); return next++; }, clearTimer = id => timers.delete(id);
  const fire = () => { const [[id, timer]] = [...timers]; timers.delete(id); timer.fn(); };
  const progress = [];
  const promise = sendSubmissionUpload("https://api.test/planting-reports", { headers: { Authorization: "Bearer t", "Idempotency-Key": "key-1" }, body: "form" },
    { onProgress: value => progress.push(value), stallMs: 60, responseMs: 120, createRequest: () => xhr, setTimer, clearTimer });
  promise.catch(() => {});
  const sent = (loaded, total = 100) => xhr.upload.onprogress({ lengthComputable: true, loaded, total });
  const answer = (status, body) => { xhr.status = status; xhr.responseText = typeof body === "string" ? body : JSON.stringify(body); xhr.onload(); };
  return { xhr, timers, fire, progress, promise, sent, answer, waiting: () => [...timers.values()].map(timer => timer.ms) };
}

test("a slow upload is not limited while it keeps progressing, and the same headers and body are sent once", async () => {
  const s = setup();
  for (let loaded = 5; loaded <= 100; loaded += 5) { s.sent(loaded); assert.deepEqual(s.waiting(), [loaded < 100 ? 60 : 120]); }
  s.xhr.upload.onload(); assert.deepEqual(s.waiting(), [120]);
  s.answer(201, { success: true, data: { id: "r" } });
  const response = await s.promise;
  assert.deepEqual([response.status, response.ok, (await response.json()).data.id], [201, true, "r"]);
  assert.deepEqual([s.xhr.method, s.xhr.url, s.xhr.body, s.xhr.headers], ["POST", "https://api.test/planting-reports", "form", { Authorization: "Bearer t", "Idempotency-Key": "key-1" }]);
  assert.deepEqual(s.progress.at(0), { phase: "uploading", percent: 5 }); assert.deepEqual(s.progress.at(-1), { phase: "processing", percent: 100 });
  assert.equal(s.timers.size, 0); assert.equal(s.xhr.aborted, 0);
});

test("an upload that stops partway was not saved: it is not ambiguous and the request is stopped", async () => {
  const s = setup(); s.sent(40); s.fire();
  await assert.rejects(s.promise, error => error instanceof UploadNotCompletedError && !isAmbiguousWriteFailure(error) && /not saved/i.test(error.message));
  assert.equal(s.xhr.aborted, 1); assert.equal(s.timers.size, 0);
});
test("a connection lost partway was not saved", async () => {
  const s = setup(); s.sent(40); s.xhr.onerror();
  await assert.rejects(s.promise, error => error instanceof UploadNotCompletedError && !isAmbiguousWriteFailure(error));
});

for (const [name, act] of [["the upload finished and the answer never came", s => { s.sent(100); s.xhr.upload.onload(); s.fire(); }], ["the upload finished and the connection dropped", s => { s.sent(100); s.xhr.onerror(); }],
  ["no progress was ever reported and the connection dropped", s => s.xhr.onerror()], ["no progress was ever reported and nothing came back", s => s.fire()]]) {
  test(`${name}: the outcome is unknown`, async () => {
    const s = setup(); act(s);
    await assert.rejects(s.promise, error => error instanceof RequestTimeoutError && isAmbiguousWriteFailure(error)); assert.equal(s.timers.size, 0);
  });
}
test("without progress events the longer answer limit applies, not the stall limit", () => { const s = setup(); assert.deepEqual(s.waiting(), [120]); });

test("a server answer is always used, even before the upload ends, and unreadable bodies are empty", async () => {
  const early = setup(); early.sent(20); early.answer(503, { success: false, message: "Evidence uploads are temporarily unavailable." });
  const refused = await early.promise; assert.equal(refused.status, 503); assert.equal(refused.ok, false); assert.match((await refused.json()).message, /temporarily unavailable/);
  const html = setup(); html.sent(100); html.answer(502, "<h1>Bad gateway</h1>");
  await assert.rejects((await html.promise).json());
});

test("only MENRO's own 'still processing' answers count as processing", () => {
  assert.equal(isEvidenceStillProcessing(202, {}), true); assert.equal(isEvidenceStillProcessing(200, { success: false, code: "EVIDENCE_IN_PROGRESS" }), true);
  for (const [status, body] of [[201, { success: true }], [409, { code: "IDEMPOTENCY_CONFLICT" }], [503, { code: "EVIDENCE_RECONCILIATION_REQUIRED" }], [400, null]]) assert.equal(isEvidenceStillProcessing(status, body), false);
  assert.match(PROCESSING_MESSAGE, /still/i);
});

test("a photo the device can no longer read is named; readable photos are not", async () => {
  const good = new File([new Uint8Array(10)], "a.jpg"), bad = { name: "b.jpg", size: 10, slice: () => ({ arrayBuffer: async () => { throw new DOMException("x", "NotReadableError"); } }) };
  assert.equal(await findUnreadableFile([good, bad]), bad); assert.equal(await findUnreadableFile([good]), null); assert.equal(await findUnreadableFile([]), null);
});
