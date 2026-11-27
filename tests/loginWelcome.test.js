// The dashboard login alert says "Welcome!" only when the backend reported the account's first sign-in, and keeps
// "Welcome back!" otherwise (including when the flag is missing). The pending login is consumed once, for that user.
import assert from "node:assert/strict";
import test from "node:test";
import { consumeSuccessfulLogin, consumeSuccessfulLoginAlert, loginSuccessMessage, markSuccessfulLogin } from "../src/utils/loginSuccess.js";

function withSession(run) {
  const previous = globalThis.window, data = new Map();
  globalThis.window = { sessionStorage: { setItem: (k, v) => data.set(k, v), getItem: (k) => data.get(k) ?? null, removeItem: (k) => data.delete(k) }, dispatchEvent() {} };
  try { run(); } finally { globalThis.window = previous; }
}

test("login alert text for first-time and returning users", () => {
  assert.equal(loginSuccessMessage(true), "Welcome! You have successfully signed in.");
  assert.equal(loginSuccessMessage(false), "Welcome back! You have successfully signed in.");
  assert.equal(loginSuccessMessage(undefined), "Welcome back! You have successfully signed in.");
});

test("the first-login flag from the verified session travels with the pending login, consumed once", () => withSession(() => {
  markSuccessfulLogin({ uid: "new-user", firstLogin: true });
  const alert = consumeSuccessfulLoginAlert({ uid: "new-user" });
  assert.equal(typeof alert.nonce, "string");
  assert.equal(alert.firstLogin, true);
  assert.equal(consumeSuccessfulLoginAlert({ uid: "new-user" }), null);

  markSuccessfulLogin({ uid: "returning", firstLogin: false });
  assert.equal(consumeSuccessfulLoginAlert({ uid: "returning" }).firstLogin, false);
  markSuccessfulLogin({ uid: "no-flag" });
  assert.equal(consumeSuccessfulLoginAlert({ uid: "no-flag" }).firstLogin, false);
  markSuccessfulLogin({ uid: "string-flag", firstLogin: "true" });
  assert.equal(consumeSuccessfulLoginAlert({ uid: "string-flag" }).firstLogin, false, "only a boolean true counts");

  markSuccessfulLogin({ uid: "new-user", firstLogin: true });
  assert.equal(consumeSuccessfulLoginAlert({ uid: "someone-else" }), null);
  // The existing nonce-only reader keeps working.
  markSuccessfulLogin({ uid: "staff" });
  assert.equal(typeof consumeSuccessfulLogin({ uid: "staff" }), "string");
}));
