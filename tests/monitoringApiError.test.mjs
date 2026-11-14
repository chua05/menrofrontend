import test from "node:test";
import assert from "node:assert/strict";
import { monitoringApiErrorMessage } from "../src/utils/monitoringApiError.js";

test("missing-index responses never expose the raw Firestore error or console link", () => {
  const raw = "9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/x/firestore/indexes?create_composite=abc";
  for (const body of [{ code: "MONITORING_QUERY_INDEX_MISSING", message: "x" }, { message: raw }]) {
    const text = monitoringApiErrorMessage(body);
    assert.match(text, /required database index is not ready/);
    assert.doesNotMatch(text, /console\.firebase|FAILED_PRECONDITION|create_composite/);
  }
});

test("gate, empty and ordinary backend messages keep their meaning", () => {
  assert.equal(monitoringApiErrorMessage({ code: "COHORT_WORKFLOW_DISABLED" }), "Permanent sample tree monitoring is not enabled on the MENRO server yet.");
  assert.equal(monitoringApiErrorMessage({}), "Monitoring visits could not be loaded.");
  assert.equal(monitoringApiErrorMessage({ message: "Monitoring visit is not ready for review." }), "Monitoring visit is not ready for review.");
});
