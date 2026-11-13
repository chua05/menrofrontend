import test from "node:test";
import assert from "node:assert/strict";
import { readinessMessages, readinessTitle } from "../src/utils/sampleVisitReadiness.js";

test("every backend readiness code becomes a plain Staff-facing sentence", () => {
  const messages = readinessMessages([
    { code: "WRITES_PAUSED" },
    { code: "SAMPLING_POLICY_SNAPSHOT_MISSING" },
    { code: "SAMPLING_POLICY_PENDING", pending: ["MINIMUM_SAMPLE_POLICY_PENDING", "FIRST_VISIT_DELAY_PENDING"] },
    { code: "SAMPLING_PLAN_NOT_APPROVED", planStatus: "PENDING_ADMIN_APPROVAL" },
    { code: "TEST_ONLY_SAMPLING_POLICY" },
    { code: "BASELINE_NOT_APPROVED", baselineStatus: "REGISTERED" },
    { code: "OPEN_VISIT_EXISTS", visitStatus: "RETURNED", ownedByYou: true },
    { code: "VISIT_SCHEDULING_POLICY_PENDING" },
  ]);
  assert.deepEqual(messages, [
    "Permanent-sample changes are currently paused by MENRO.",
    "This planting report has no MENRO-approved sampling policy.",
    "The MENRO sampling policy is incomplete: minimum sample size, first visit timing.",
    "The sampling plan is not approved yet (current status: Pending Admin Review).",
    "The sampling plan uses a test-only rule and must be replaced under an approved MENRO policy.",
    "The permanent sample baseline is not approved yet (current status: Registered).",
    "You already have an open visit for this site (Returned for Correction). Continue it from the visit list.",
    "New monitoring visits can start only after MENRO approves the visit scheduling policy.",
  ]);
  assert.doesNotMatch(messages.join(" "), /_POLICY|_PENDING|OPEN_VISIT|undefined/);
});

test("another Staff member's open visit is described without identifying them", () => {
  assert.deepEqual(readinessMessages([{ code: "OPEN_VISIT_EXISTS", visitStatus: "PENDING_ADMIN_APPROVAL", ownedByYou: false }]),
    ["Another Staff member has an open visit for this site (Pending Admin Review)."]);
});

test("unknown codes and missing labels degrade safely", () => {
  assert.deepEqual(readinessMessages([{ code: "SOMETHING_NEW" }, null]), ["This site is not ready for permanent-sample monitoring."]);
  assert.equal(readinessTitle({ reportNumber: "PR-1", siteName: "Bical site" }), "PR-1 · Bical site");
  assert.equal(readinessTitle({}), "Planting report · Planting site");
});
