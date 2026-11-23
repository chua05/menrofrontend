export const OTHER_REJECTION_REASON = "Other (Specify Reason)";

export const SEEDLING_REJECTION_REASONS = Object.freeze([
  "Insufficient seedling stock",
  "Supporting documents or letter is invalid",
  "Proposed planting site is unsuitable or not approved",
  "Planting purpose does not meet program guidelines",
  "Duplicate or previously fulfilled request",
  OTHER_REJECTION_REASON,
]);

export function resolveSeedlingRejectionReason(choice, otherReason = "") {
  const selected = typeof choice === "string" ? choice.trim() : "";
  if (!SEEDLING_REJECTION_REASONS.includes(selected)) return "";
  return selected === OTHER_REJECTION_REASON
    ? (typeof otherReason === "string" ? otherReason.trim() : "")
    : selected;
}
