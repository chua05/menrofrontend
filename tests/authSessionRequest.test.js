import test from "node:test";
import assert from "node:assert/strict";
import { createAuthSessionRequest, requestWithTimeout } from "../src/services/authSessionRequest.js";

test("concurrent auth consumers share one slow verification request", async () => {
  let resolveRequest;
  let calls = 0;
  const coordinator = createAuthSessionRequest(() => {
    calls += 1;
    return new Promise((resolve) => {
      resolveRequest = resolve;
    });
  });
  const firebaseUser = { uid: "google-user" };

  const contextResult = coordinator.verify(firebaseUser);
  const loginResult = coordinator.verify(firebaseUser);

  assert.equal(calls, 1);
  assert.strictEqual(contextResult, loginResult);
  resolveRequest({ uid: firebaseUser.uid, role: "participant" });
  assert.deepEqual(await loginResult, { uid: firebaseUser.uid, role: "participant" });
  assert.strictEqual(
    coordinator.verify(firebaseUser),
    contextResult,
    "the verified profile is reused for the same Firebase session",
  );
});

test("a confirmed verification failure can be retried safely", async () => {
  let calls = 0;
  const coordinator = createAuthSessionRequest(async () => {
    calls += 1;
    if (calls === 1) throw new Error("backend unavailable");
    return { role: "participant" };
  });
  const firebaseUser = { uid: "google-user" };

  await assert.rejects(coordinator.verify(firebaseUser), /backend unavailable/);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.deepEqual(await coordinator.verify(firebaseUser), { role: "participant" });
  assert.equal(calls, 2);
});

test("reset starts one new authoritative verification for a later session", async () => {
  let calls = 0;
  const coordinator = createAuthSessionRequest(async (firebaseUser) => {
    calls += 1;
    return { uid: firebaseUser.uid, call: calls };
  });
  const firebaseUser = { uid: "google-user" };

  assert.equal((await coordinator.verify(firebaseUser)).call, 1);
  coordinator.reset();
  assert.equal((await coordinator.verify(firebaseUser)).call, 2);
});

function manualTimer() {
  const timer = { pending: null, delay: null, cleared: false,
    set(callback, delay) { timer.pending = callback; timer.delay = delay; return 1; },
    clear() { timer.cleared = true; timer.pending = null; } };
  return timer;
}
const timeoutError = () => Object.assign(new Error("The MENRO server could not be reached."), { code: "BACKEND_UNAVAILABLE" });

test("a backend verification that never answers fails instead of hanging", async () => {
  const timer = manualTimer();
  let seenSignal;
  const result = requestWithTimeout(signal => { seenSignal = signal; return new Promise(() => {}); },
    { timeoutMs: 60000, timeoutError, setTimer: timer.set, clearTimer: timer.clear });
  assert.equal(timer.delay, 60000);
  timer.pending();
  await assert.rejects(result, error => error.code === "BACKEND_UNAVAILABLE");
  assert.equal(seenSignal.aborted, true, "the stalled request is cancelled");
});

test("a verification that answers in time is returned and its timer cleared", async () => {
  const timer = manualTimer();
  const profile = await requestWithTimeout(async () => ({ uid: "staff-user", role: "staff" }),
    { timeoutMs: 60000, timeoutError, setTimer: timer.set, clearTimer: timer.clear });
  assert.deepEqual(profile, { uid: "staff-user", role: "staff" });
  assert.equal(timer.cleared, true);
});

test("a verification error is passed through unchanged", async () => {
  const timer = manualTimer(), rejected = Object.assign(new Error("rejected"), { code: "BACKEND_FORBIDDEN" });
  await assert.rejects(requestWithTimeout(async () => { throw rejected; },
    { timeoutMs: 60000, timeoutError, setTimer: timer.set, clearTimer: timer.clear }), error => error === rejected);
  assert.equal(timer.cleared, true);
});

test("a timed-out verification is not reused, so signing in again starts a new request", async () => {
  const timer = manualTimer();
  let calls = 0;
  const coordinator = createAuthSessionRequest(() => {
    calls += 1;
    return calls === 1
      ? requestWithTimeout(() => new Promise(() => {}), { timeoutMs: 60000, timeoutError, setTimer: timer.set, clearTimer: timer.clear })
      : Promise.resolve({ uid: "participant-user", role: "participant" });
  });
  const firebaseUser = { uid: "participant-user" };
  const first = coordinator.verify(firebaseUser);
  timer.pending();
  await assert.rejects(first, error => error.code === "BACKEND_UNAVAILABLE");
  assert.deepEqual(await coordinator.verify(firebaseUser), { uid: "participant-user", role: "participant" });
  assert.equal(calls, 2);
});
