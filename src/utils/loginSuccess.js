const KEY = "menro:pending-dashboard-login";
const INTENT = "menro:interactive-login";
export function beginInteractiveLogin() {
  clearSuccessfulLogin();
  try { window.sessionStorage.setItem(INTENT, "true"); } catch { /* Optional UX state. */ }
}
export function hasInteractiveLoginIntent() {
  try { return ["true", "complete"].includes(window.sessionStorage.getItem(INTENT)); } catch { return false; }
}
export function isInteractiveLoginPending() {
  try { return window.sessionStorage.getItem(INTENT) === "true"; } catch { return false; }
}
export function clearSuccessfulLogin() {
  try { window.sessionStorage.removeItem(KEY); window.sessionStorage.removeItem(INTENT); } catch { /* Optional UX state. */ }
  window.dispatchEvent?.(new Event("menro:clear-login-toast"));
}
export function markSuccessfulLogin(user) {
  const uid = user?.uid || user?.id;
  if (!uid) return;
  try { window.sessionStorage.setItem(INTENT, "complete"); window.sessionStorage.setItem(KEY, JSON.stringify({ uid, nonce: crypto.randomUUID(), createdAt: Date.now(), firstLogin: user?.firstLogin === true })); } catch { /* Authentication must not depend on optional toast storage. */ }
}
// The verified session's firstLogin flag (reported by the backend) decides the greeting; anything else is a returning user.
export function loginSuccessMessage(firstLogin) {
  return firstLogin === true ? "Welcome! You have successfully signed in." : "Welcome back! You have successfully signed in.";
}
export function consumeSuccessfulLogin(user) {
  return consumeSuccessfulLoginAlert(user)?.nonce ?? null;
}
export function consumeSuccessfulLoginAlert(user) {
  try {
    const value = window.sessionStorage.getItem(KEY);
    if (!value) return null;
    const pending = JSON.parse(value);
    window.sessionStorage.removeItem(KEY);
    window.sessionStorage.removeItem(INTENT);
    const age = Date.now() - pending.createdAt;
    return pending.uid === (user?.uid || user?.id) && Number.isFinite(age) && age >= 0 && age <= 30000
      ? { nonce: pending.nonce, firstLogin: pending.firstLogin === true } : null;
  } catch { return null; }
}
