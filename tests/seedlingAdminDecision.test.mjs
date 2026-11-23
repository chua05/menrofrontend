import assert from "node:assert/strict";
import test from "node:test";
import {
  OTHER_REJECTION_REASON,
  SEEDLING_REJECTION_REASONS,
  resolveSeedlingRejectionReason,
} from "../src/utils/seedlingAdminDecision.js";

test("Admin seedling rejection reasons are the approved ordered list", () => {
  assert.deepEqual(SEEDLING_REJECTION_REASONS, [
    "Insufficient seedling stock",
    "Supporting documents or letter is invalid",
    "Proposed planting site is unsuitable or not approved",
    "Planting purpose does not meet program guidelines",
    "Duplicate or previously fulfilled request",
    "Other (Specify Reason)",
  ]);
});

test("rejection reason resolution trims Other and excludes stale or unapproved text", () => {
  assert.equal(resolveSeedlingRejectionReason("Insufficient seedling stock", "stale custom"), "Insufficient seedling stock");
  assert.equal(resolveSeedlingRejectionReason(OTHER_REJECTION_REASON, "  Site ownership is unresolved.  "), "Site ownership is unresolved.");
  assert.equal(resolveSeedlingRejectionReason(OTHER_REJECTION_REASON, "   "), "");
  assert.equal(resolveSeedlingRejectionReason("Legacy arbitrary text", ""), "");
  assert.equal(resolveSeedlingRejectionReason("", "stale custom"), "");
});
