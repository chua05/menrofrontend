import { normalizeTimestamp } from "./timestampValues.js";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, "0");

export function normalizeSearchText(value) {
  if (value === null || value === undefined) return "";
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function validYmd(y, m, d) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1000 && y <= 9999)) return null;
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? { y, m, d } : null;
}

function monthFromName(name) {
  const key = normalizeSearchText(name).replace(/\.$/, "");
  if (key.length < 3) return 0;
  const index = MONTHS.findIndex((month) => month === key || (key.length === 3 || key === "sept") && month.startsWith(key.slice(0, 3)));
  return index + 1;
}

function parseDateText(text) {
  const s = normalizeSearchText(text).replace(/,/g, " ").replace(/\s+/g, " ").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return validYmd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return validYmd(+m[3], +m[1], +m[2]);
  m = s.match(/^([a-z]{3,9}\.?) (\d{1,2}) (\d{4})$/);
  if (m) return validYmd(+m[3], monthFromName(m[1]), +m[2]);
  m = s.match(/^(\d{1,2}) ([a-z]{3,9}\.?) (\d{4})$/);
  if (m) return validYmd(+m[3], monthFromName(m[2]), +m[1]);
  return null;
}

function calendarDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const plain = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (plain) return validYmd(+plain[1], +plain[2], +plain[3]);
    if (!/^\d{4}-\d{2}-\d{2}[T ]/.test(value.trim())) return null;
  } else if (typeof value !== "object") {
    return null;
  }
  const date = normalizeTimestamp(value);
  if (!date) return null;
  const manila = new Date(date.getTime() + MANILA_OFFSET_MS);
  return { y: manila.getUTCFullYear(), m: manila.getUTCMonth() + 1, d: manila.getUTCDate() };
}

function variantsFor({ y, m, d }) {
  const long = MONTHS[m - 1];
  const short = long.slice(0, 3);
  return [`${y}-${pad(m)}-${pad(d)}`, `${pad(m)}/${pad(d)}/${y}`, `${short} ${d}, ${y}`, `${long} ${d}, ${y}`, `${d} ${short} ${y}`, `${short} ${d} ${y}`];
}

export function dateSearchVariants(value) {
  const parts = calendarDate(value);
  return parts ? variantsFor(parts) : [];
}

export function numberSearchVariants(value) {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value.replace(/,/g, "")) : NaN;
  if (!Number.isFinite(n)) return [];
  const plain = String(n);
  const grouped = n.toLocaleString("en-US", { maximumFractionDigits: 20 });
  return plain === grouped ? [plain] : [plain, grouped];
}

function collect(value, out) {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) { value.forEach((item) => collect(item, out)); return; }
  if (typeof value === "number") { out.push(...numberSearchVariants(value)); return; }
  if (typeof value === "boolean") { out.push(String(value)); return; }
  const dates = dateSearchVariants(value);
  if (dates.length) {
    out.push(...dates);
    if (typeof value === "string" && !/^\d{4}-\d{2}-\d{2}[T ]/.test(value.trim())) out.push(value);
    return;
  }
  if (typeof value === "string") {
    out.push(value);
    if (/^\d[\d,]*(\.\d+)?$/.test(value.trim())) out.push(...numberSearchVariants(value));
    return;
  }
  if (value instanceof Date || typeof value === "object") return;
  out.push(String(value));
}

/** Returns an already-normalised string: build it once per record, then pass it to matchesSearch (which only normalises the query). */
export function buildSearchIndex(values) {
  const out = [];
  collect(values, out);
  return out.map(normalizeSearchText).filter(Boolean).join(" | ");
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A whole date must not match inside a longer one: "2 oct 2026" is text inside "12 oct 2026". Only digits
// break the match, so "2026-10-12T08:00" in free text still matches.
function containsWhole(haystack, phrase) {
  return new RegExp(`(^|[^0-9])${escapeRegExp(phrase)}(?![0-9])`).test(haystack);
}

const GROUPED_NUMBER = /^\d{1,3}(,\d{3})+(\.\d+)?$/;

// "1,000" names one whole quantity: match it (grouped or plain) without digits on either side.
function containsNumber(haystack, grouped) {
  return [grouped, grouped.replace(/,/g, "")].some((form) =>
    new RegExp(`(^|[^\\d,.])${escapeRegExp(form)}(?![\\d]|[,.]\\d)`).test(haystack));
}

function queryTokens(q) {
  return q.split(" ").flatMap((word) => (GROUPED_NUMBER.test(word) ? [word] : word.split(","))).filter(Boolean);
}

export function matchesSearch(index, query) {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const haystack = typeof index === "string" ? index : normalizeSearchText(index);
  const asDate = parseDateText(q);
  if (asDate) return variantsFor(asDate).some((variant) => containsWhole(haystack, variant)) || containsWhole(haystack, q);
  return queryTokens(q).every((token) => (GROUPED_NUMBER.test(token) ? containsNumber(haystack, token) : haystack.includes(token)));
}
