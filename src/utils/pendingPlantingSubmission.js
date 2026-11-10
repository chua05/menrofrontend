// Remembers a planting-report submission whose outcome is unknown (it timed
// out after it was sent) so closing the form, or reloading the page, cannot
// lose it. Kept per signed-in user for this browser tab only; every storage
// access is guarded and falls back to memory.
const PREFIX = "menro.pendingPlantingSubmission.";
const memory = new Map();

function storage() {
  try { return typeof window !== "undefined" ? window.sessionStorage : null; } catch { return null; }
}

const keyFor = (kind, uid) => (uid && ["participant", "staff"].includes(kind) ? `${PREFIX}${kind}.${uid}` : "");

export function loadPendingSubmission(kind, uid) {
  const key = keyFor(kind, uid);
  if (!key) return null;
  let raw = memory.get(key) ?? null;
  try { raw = storage()?.getItem(key) ?? raw; } catch { /* memory copy is used */ }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && value.kind === kind ? value : null;
  } catch { return null; }
}

export function savePendingSubmission(kind, uid, value) {
  const key = keyFor(kind, uid);
  if (!key) return;
  const raw = JSON.stringify({ ...value, kind, savedAt: value?.savedAt || new Date().toISOString() });
  memory.set(key, raw);
  try { storage()?.setItem(key, raw); } catch { /* memory copy is used */ }
}

export function clearPendingSubmission(kind, uid) {
  const key = keyFor(kind, uid);
  if (!key) return;
  memory.delete(key);
  try { storage()?.removeItem(key); } catch { /* nothing stored */ }
}
