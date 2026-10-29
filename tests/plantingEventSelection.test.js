import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  formatTimestampDate,
  normalizeTimestamp,
  timestampToDateInput,
} from "../src/utils/timestampValues.js";

const plantingPage = readFileSync(
  new URL("../src/pages/PlantingPage.jsx", import.meta.url),
  "utf8",
);

test("selecting an event renders a serialized distribution release date as text", () => {
  const releasedAt = { _seconds: 1791849600, _nanoseconds: 0 };
  const rendered = formatTimestampDate(releasedAt);

  assert.equal(typeof rendered, "string");
  assert.match(rendered, /Oct 13, 2026/);
  assert.match(plantingPage, /formatDate\(distribution\.releasedAt\)/);
});

test("event selection safely displays malformed participant-count metadata", () => {
  assert.match(plantingPage, /function formatParticipantCount\(value\)/);
  assert.match(plantingPage, /PlantingReportFormErrorBoundary/);
  assert.match(plantingPage, /const selectedEventRequestId = String\(selectedEvent\?\.sourceRequestId \|\| ""\)\.trim\(\)/);
  assert.match(plantingPage, /resetKey=\{formRenderRecovery\}/);
  assert.match(plantingPage, /retry without losing this report draft/i);
  assert.match(plantingPage, /formatParticipantCount\(\s*responsibleEvent\?\.actualParticipants/s);
  assert.match(plantingPage, /replace\(\/\(\[a-z\]\)\\\.\\s\+\/gi, "\$1\."\)/);
});

test("planting event dates accept Firestore, serialized, ISO, and missing values", () => {
  const instant = new Date("2026-10-13T00:00:00.000Z");
  const firestoreTimestamp = { toDate: () => instant };
  const serializedTimestamp = { _seconds: 1791849600, _nanoseconds: 500_000_000 };

  assert.equal(timestampToDateInput(firestoreTimestamp), "2026-10-13");
  assert.equal(timestampToDateInput(serializedTimestamp), "2026-10-13");
  assert.equal(timestampToDateInput("2026-10-13T08:00:00+08:00"), "2026-10-13");
  assert.equal(timestampToDateInput(null), "");
  assert.equal(formatTimestampDate(null), "—");
});

test("invalid timestamp objects never escape into React rendering", () => {
  const invalidTimestamp = { _seconds: "not-a-number", _nanoseconds: 0 };

  assert.equal(normalizeTimestamp(invalidTimestamp), null);
  assert.equal(formatTimestampDate(invalidTimestamp), "—");
});
