import assert from "node:assert/strict";
import test from "node:test";
import { mergeNotificationPages, notificationEmptyMessage } from "../src/utils/notificationList.js";

const createdAt = (seconds, nanoseconds = 0) => ({ _seconds: seconds, _nanoseconds: nanoseconds });

test("notification pages merge newest-first without duplicate records", () => {
  const current = [
    { id: "b", createdAt: createdAt(2), isRead: false },
    { id: "a", createdAt: createdAt(1), isRead: false },
  ];
  const incoming = [
    { id: "c", createdAt: createdAt(3), isRead: false },
    { id: "b", createdAt: createdAt(2), isRead: true },
  ];
  const merged = mergeNotificationPages(current, incoming);
  assert.deepEqual(merged.map((item) => item.id), ["c", "b", "a"]);
  assert.equal(merged.find((item) => item.id === "b").isRead, true);
});

test("notification page replacement removes stale filter results", () => {
  const result = mergeNotificationPages(
    [{ id: "unread", createdAt: createdAt(2) }],
    [{ id: "read", createdAt: createdAt(1), isRead: true }],
    { replace: true },
  );
  assert.deepEqual(result.map((item) => item.id), ["read"]);
});

test("empty-state copy reflects active filters", () => {
  assert.match(notificationEmptyMessage("unread"), /unread/i);
  assert.match(notificationEmptyMessage("read"), /read/i);
  assert.equal(notificationEmptyMessage("all"), "No notifications yet.");
});
