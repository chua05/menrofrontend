export function normalizeTimestamp(value) {
  if (!value) return null;

  let date;

  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (typeof value === "object") {
    const seconds = value._seconds ?? value.seconds;
    const nanoseconds = value._nanoseconds ?? value.nanoseconds ?? 0;
    if (!Number.isFinite(seconds) || !Number.isFinite(nanoseconds)) return null;
    date = new Date(seconds * 1000 + nanoseconds / 1_000_000);
  } else {
    date = new Date(value);
  }

  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

export function formatTimestampDate(value, fallback = "—") {
  const date = normalizeTimestamp(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function timestampToDateInput(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = normalizeTimestamp(value);
  return date ? date.toISOString().slice(0, 10) : "";
}
