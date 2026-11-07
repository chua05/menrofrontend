// Mirrors menroBK/src/utils/philippineContact.util.js.
// Mobile: 09XX XXX XXXX. Landline: (02) XXXX XXXX or (0XX) XXX XXXX. Both accept +63 or 63.
const PHILIPPINE_CONTACT_NUMBER = /^(?:\+?63|0)(?:9\d{9}|[2-8]\d{8})$/;

export const INVALID_CONTACT_NUMBER_MESSAGE = "Enter a valid Philippine mobile or landline number.";

export function isValidPhilippineContactNumber(value) {
  return PHILIPPINE_CONTACT_NUMBER.test(String(value ?? "").replace(/[\s().-]/g, ""));
}
