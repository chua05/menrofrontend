const KEY = "menro:pending-dashboard-login";
export function markSuccessfulLogin(user) {
  const uid = user?.uid || user?.id;
  if (!uid) return;
  try { window.sessionStorage.setItem(KEY, JSON.stringify({ uid, nonce: crypto.randomUUID() })); } catch { /* Authentication must not depend on optional toast storage. */ }
}
export function consumeSuccessfulLogin(user) {
  try {
    const value = window.sessionStorage.getItem(KEY);
    if (!value) return null;
    const pending = JSON.parse(value);
    window.sessionStorage.removeItem(KEY);
    return pending.uid === (user?.uid || user?.id) ? pending.nonce : null;
  } catch { return null; }
}
