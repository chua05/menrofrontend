import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const login = fs.readFileSync(new URL("../src/pages/LoginPage.jsx", import.meta.url), "utf8");
const register = fs.readFileSync(new URL("../src/pages/RegisterPage.jsx", import.meta.url), "utf8");
const protectedRoute = fs.readFileSync(new URL("../src/routes/ProtectedRoute.jsx", import.meta.url), "utf8");
const rootRedirect = fs.readFileSync(new URL("../src/routes/RootRedirect.jsx", import.meta.url), "utf8");

test("Messenger is not preemptively blocked from the existing Google popup flow", () => {
  assert.doesNotMatch(login, /if \(inAppBrowser\)/);
  assert.match(login, /await startGooglePopup\(\)/);
  assert.match(login, /isGoogleUnsupportedBrowserError\(err\)/);
});

test("email-password and registration authentication paths remain available", () => {
  assert.match(login, /signInWithEmailAndPassword/);
  assert.match(register, /handleGoogleRegister/);
  assert.match(register, /await startGooglePopup\(\)/);
  assert.match(register, /publicApiFetch\("\/auth\/register"/);
});

test("fresh sign-in uses the verified role dashboard and authenticated deep links remain guarded", () => {
  assert.match(protectedRoute, /state=\{\{ from \}\}/);
  assert.equal((login.match(/resolveInteractiveLoginPath\(userData\)/g) || []).length, 2);
  assert.match(rootRedirect, /hasInteractiveLoginIntent\(\) \? undefined : location\.state\?\.from/);
});
