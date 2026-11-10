// Guest attendance (Full Name, Contact Number, Address). The backend is the
// authority; these checks give immediate, matching feedback.
export const MAX_ATTENDANCE_ADDRESS_LENGTH = 200;
// Control characters other than tab/newline/carriage return are refused.
const CONTROL_CHARACTERS = { test: (text) => [...String(text)].some((character) => {
  const code = character.charCodeAt(0);
  return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
}) };

export function normalizeGuestContact(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("63") && digits.length === 12 ? `0${digits.slice(2)}` : digits;
}

export function guestAttendanceErrors(form = {}) {
  const errors = {};
  const name = String(form.fullName || "").replace(/\s+/g, " ").trim();
  const address = String(form.address || "").replace(/\s+/g, " ").trim();
  if (CONTROL_CHARACTERS.test(String(form.fullName || ""))) errors.fullName = "Remove unsupported characters.";
  else if (name.length < 2 || name.length > 120) errors.fullName = "Enter your full name (2–120 characters).";
  if (!/^09\d{9}$/.test(normalizeGuestContact(form.contactNumber))) errors.contactNumber = "Enter a valid mobile number, e.g. 09123456789.";
  if (CONTROL_CHARACTERS.test(String(form.address || ""))) errors.address = "Remove unsupported characters.";
  else if (address.length < 5 || address.length > MAX_ATTENDANCE_ADDRESS_LENGTH) errors.address = `Enter your address (5–${MAX_ATTENDANCE_ADDRESS_LENGTH} characters).`;
  return errors;
}

export function attendanceOpensLabel(opensAt) {
  if (!opensAt) return "";
  const date = new Date(opensAt);
  if (!Number.isFinite(date.getTime())) return "";
  return ` (${date.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })})`;
}
