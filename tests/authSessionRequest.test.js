import test from "node:test";
import assert from "node:assert/strict";
import { createAuthSessionRequest } from "../src/services/authSessionRequest.js";

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
