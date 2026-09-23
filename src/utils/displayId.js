const EMPTY_ID = "—";

function stableToken(value) {
  let hash = 2166136261;

  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(-7);
}

export function formatDisplayId(prefix, ...candidates) {
  const values = candidates
    .flat()
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (values.length === 0) return EMPTY_ID;

  const normalizedPrefix = String(prefix || "REC").trim().toUpperCase();
  const canonicalPattern = new RegExp(
    `^${normalizedPrefix}-(?:\\d{4}-\\d{3,}|[A-Z0-9]{5,10})$`,
    "i"
  );
  const canonical = values.find((value) => canonicalPattern.test(value));

  if (canonical) return canonical.toUpperCase();

  return `${normalizedPrefix}-${stableToken(values[0])}`;
}

