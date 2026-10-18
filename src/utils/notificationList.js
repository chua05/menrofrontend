function timestampMillis(value) {
  const seconds = value?.seconds ?? value?._seconds;
  const nanoseconds = value?.nanoseconds ?? value?._nanoseconds ?? 0;
  return Number(seconds || 0) * 1000 + Number(nanoseconds || 0) / 1_000_000;
}

export function mergeNotificationPages(current, incoming, { replace = false } = {}) {
  const merged = new Map();
  if (!replace) (current || []).forEach((item) => merged.set(item.id, item));
  (incoming || []).forEach((item) => merged.set(item.id, item));
  return [...merged.values()].sort((left, right) => {
    const timeDifference = timestampMillis(right.createdAt) - timestampMillis(left.createdAt);
    return timeDifference || String(right.id).localeCompare(String(left.id));
  });
}

export function notificationEmptyMessage(readState) {
  if (readState === "unread") return "No unread notifications in this view.";
  if (readState === "read") return "No read notifications in this view.";
  return "No notifications yet.";
}
