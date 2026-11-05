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
  try { window.sessionStorage.setItem(INTENT, "complete"); window.sessionStorage.setItem(KEY, JSON.stringify({ uid, nonce: crypto.randomUUID(), createdAt: Date.now() })); } catch { /* Authentication must not depend on optional toast storage. */ }
}
export function consumeSuccessfulLogin(user) {
  try {
    const value = window.sessionStorage.getItem(KEY);
    if (!value) return null;
    const pending = JSON.parse(value);
    window.sessionStorage.removeItem(KEY);
    window.sessionStorage.removeItem(INTENT);
    const age = Date.now() - pending.createdAt;
    return pending.uid === (user?.uid || user?.id) && Number.isFinite(age) && age >= 0 && age <= 30000 ? pending.nonce : null;
  } catch { return null; }
}
