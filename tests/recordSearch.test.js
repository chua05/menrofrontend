import assert from "node:assert/strict";
import test from "node:test";
import { buildSearchIndex, dateSearchVariants, matchesSearch, normalizeSearchText, numberSearchVariants } from "../src/utils/recordSearch.js";

const record = buildSearchIndex(["BAT-2026-003", "Donation", "Kalamansí", "2026-10-12", 1000, ["Bulan", null, ""]]);

test("normalizeSearchText", () => {
  assert.equal(normalizeSearchText("  KALAMANSÍ   Donation "), "kalamansi donation");
  assert.equal(normalizeSearchText(null), "");
});

test("variants", () => {
  assert.deepEqual(numberSearchVariants(1000), ["1000", "1,000"]);
  assert.deepEqual(numberSearchVariants("abc"), []);
  const v = dateSearchVariants("2026-10-12");
  for (const x of ["2026-10-12", "10/12/2026", "oct 12, 2026", "october 12, 2026", "12 oct 2026", "oct 12 2026"]) assert.ok(v.includes(x), x);
  assert.ok(dateSearchVariants({ seconds: Date.UTC(2026, 9, 11, 17, 0) / 1000 }).includes("2026-10-12"), "Manila date");
  assert.ok(dateSearchVariants("2026-10-11T17:00:00Z").includes("2026-10-12"));
  assert.deepEqual(dateSearchVariants("hello"), []);
});

test("matchesSearch", () => {
  for (const q of ["BAT-2026-003", "donation", "kalamansi", "2026-10-12", "Oct 12 2026", "October 12, 2026", "10/12/2026", "12 Oct 2026", "  KALAMANSI   donation ", "1,000", "1000", "bulan", "", "   "]) {
    assert.equal(matchesSearch(record, q), true, q);
  }
  assert.equal(matchesSearch(record, "donation mango"), false);
  assert.equal(matchesSearch(record, "Oct 13 2026"), false);
  assert.equal(matchesSearch(record, "2000"), false);
});

test("full-date query also matches display-text dates (token fallback)", () => {
  const display = buildSearchIndex(["Received Oct 12, 2026"]);
  assert.equal(matchesSearch(display, "Oct 12, 2026"), true);
  // Any variant of the same date matches, so a different spelling of the displayed date still hits.
  assert.equal(matchesSearch(display, "October 12 2026"), true);
  assert.equal(matchesSearch(display, "Oct 13, 2026"), false);
  const iso = buildSearchIndex(["2026-10-12"]);
  assert.equal(matchesSearch(iso, "10/12/2026"), true);
});

test("timestamp strings do not leak the UTC date; numeric strings and punctuation", () => {
  const ts = buildSearchIndex(["2026-10-11T17:00:00Z"]);
  assert.equal(matchesSearch(ts, "2026-10-12"), true);
  assert.equal(matchesSearch(ts, "2026-10-11"), false);
  assert.equal(matchesSearch(buildSearchIndex(["1000"]), "1,000"), true);
  assert.equal(matchesSearch(record, "kalamansi, donation"), true);
});

test("matchesSearch accepts a prebuilt (already normalised) index", () => {
  assert.equal(matchesSearch(record, "bat-2026"), true);
  assert.equal(record, normalizeSearchText(record));
});

test("full-date query never falls back to token AND", () => {
  const other = buildSearchIndex(["2026-10-01", 12, "BAT-2026-012", "Oct"]);
  assert.equal(matchesSearch(other, "Oct 12 2026"), false);
  assert.equal(matchesSearch(other, "2026-10-12"), false);
  const same = buildSearchIndex(["2026-10-12"]);
  for (const q of ["2026-10-12", "10/12/2026", "Oct 12, 2026", "October 12 2026", "12 Oct 2026", "oct 12 2026"]) assert.equal(matchesSearch(same, q), true, q);
  assert.equal(matchesSearch(buildSearchIndex(["Received Oct 12, 2026"]), "Oct 12, 2026"), true);
});

test("a single-digit-day date query never matches a two-digit day that ends in the same digit", () => {
  const oct12 = buildSearchIndex(["2026-10-12", "Kalamansi"]);
  for (const q of ["2026-10-02", "2026-10-2", "Oct 2, 2026", "October 2 2026", "10/2/2026", "10/02/2026", "2 Oct 2026", "2 october 2026"]) {
    assert.equal(matchesSearch(oct12, q), false, q);
  }
  const displayed = buildSearchIndex(["Released 12 Oct 2026"]);
  assert.equal(matchesSearch(displayed, "2 Oct 2026"), false);
  const oct2 = buildSearchIndex(["2026-10-02"]);
  for (const q of ["2026-10-02", "2026-10-2", "Oct 2, 2026", "10/2/2026", "2 Oct 2026"]) assert.equal(matchesSearch(oct2, q), true, q);
  for (const day of [1, 3, 9]) {
    const later = buildSearchIndex([`2026-10-${10 + day}`, `2026-10-${20 + day}`]);
    assert.equal(matchesSearch(later, `2026-10-0${day}`), false, `day ${day}`);
  }
  assert.equal(matchesSearch(buildSearchIndex(["2026-10-31"]), "Oct 1, 2026"), false);
});

test("a comma-grouped number query is one number, not separate digit tokens", () => {
  const unrelated = buildSearchIndex([3000, "2026-09-01", "BAT-2026-001"]);
  assert.equal(matchesSearch(unrelated, "1,000"), false);
  assert.equal(matchesSearch(unrelated, "1000"), false);
  const bigger = buildSearchIndex([21000, 11000, 10000]);
  assert.equal(matchesSearch(bigger, "1,000"), false);
  const exact = buildSearchIndex([1000]);
  for (const q of ["1,000", "1000"]) assert.equal(matchesSearch(exact, q), true, q);
  assert.equal(matchesSearch(buildSearchIndex(["1,000"]), "1,000"), true);
  assert.equal(matchesSearch(buildSearchIndex([12500]), "12,500"), true);
  assert.equal(matchesSearch(buildSearchIndex([1000, "Donation"]), "1,000 donation"), true);
  assert.equal(matchesSearch(buildSearchIndex([1000, "Donation"]), "1,000 mango"), false);
  // Commas still separate words.
  assert.equal(matchesSearch(record, "kalamansi,donation"), true);
});

test("a date inside free text still matches when a letter follows it", () => {
  assert.equal(matchesSearch(buildSearchIndex(["Updated 2026-10-12T08:00 by staff"]), "2026-10-12"), true);
  assert.equal(matchesSearch(buildSearchIndex(["Updated 2026-10-12T08:00 by staff"]), "2026-10-02"), false);
});
