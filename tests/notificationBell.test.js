import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const topbarPath = new URL("../src/layouts/Topbar.jsx", import.meta.url);
const stylesheetPath = new URL("../src/styles/dashboard-shell.css", import.meta.url);

test("notification bell exposes only read-state filters", async () => {
  const source = await readFile(topbarPath, "utf8");
  assert.match(source, /role="tablist" aria-label="Notification read status"/);
  assert.match(source, /\["all", "unread", "read"\]/);
  assert.doesNotMatch(source, /notification-category/);
  assert.doesNotMatch(source, /NOTIFICATION_CATEGORIES/);
});

test("mark all is present once in the footer beside Close", async () => {
  const source = await readFile(topbarPath, "utf8");
  assert.equal((source.match(/Mark all as read/g) || []).length, 1);
  assert.match(source, /className="notification-footer"[\s\S]*Close[\s\S]*markAllNotificationsRead/);
});

test("notification bell supports loading, error, empty, mark-all, and pagination states", async () => {
  const source = await readFile(topbarPath, "utf8");
  assert.match(source, /Loading notifications/);
  assert.match(source, /role="alert"/);
  assert.match(source, /notificationEmptyMessage/);
  assert.match(source, /\/notifications\/read-all/);
  assert.match(source, /Load more/);
});

test("notification publication occurs only after notification state commits", async () => {
  const source = await readFile(topbarPath, "utf8");
  assert.match(source, /useEffect\(\(\) => \{\s*publishNotifications\(notifications\);\s*\}, \[notifications\]\)/);
  const updaterBodies = [...source.matchAll(/setNotifications\(\(previous\) => \{([\s\S]*?)\n\s*\}\);/g)]
    .map((match) => match[1]);
  assert.ok(updaterBodies.length >= 2);
  updaterBodies.forEach((body) => assert.doesNotMatch(body, /publishNotifications/));
});

test("polling avoids overlap, pauses while hidden, aborts, and clears its timer", async () => {
  const source = await readFile(topbarPath, "utf8");
  assert.match(source, /notificationRequestRef\.current\.inFlight/);
  assert.match(source, /document\.visibilityState === "visible"/);
  assert.match(source, /\.controller\?\.abort\(\)/);
  assert.match(source, /window\.clearInterval\(refreshTimer\)/);
  assert.match(source, /removeEventListener\("visibilitychange"/);
});

test("notification panel remains bounded and responsive", async () => {
  const css = await readFile(stylesheetPath, "utf8");
  assert.match(css, /\.notification-list\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/s);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.notification-panel/);
  assert.match(css, /\.notification-message\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});
