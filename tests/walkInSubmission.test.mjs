import assert from "node:assert/strict";
import test from "node:test";
import {
  findPersistedSubmission,
  isAmbiguousSubmissionFailure,
  submissionFailureMessage,
} from "../src/utils/walkInSubmission.js";

test("timeout and transport failures are ambiguous but HTTP failures are definitive", () => {
  const timeout = new Error("timed out"); timeout.name = "AbortError";
  assert.equal(isAmbiguousSubmissionFailure(timeout, true), true);
  assert.equal(isAmbiguousSubmissionFailure(new TypeError("network"), true), true);
  assert.equal(isAmbiguousSubmissionFailure(Object.assign(new Error("unavailable"), { status: 503 }), true), false);
});

test("retry reconciliation finds only the matching persisted idempotency key", () => {
  const rows = [
    { id: "one", clientSubmissionId: "different" },
    { id: "saved", clientSubmissionId: "submission-123", status: "Reviewed" },
  ];
  assert.equal(findPersistedSubmission(rows, "submission-123")?.id, "saved");
  assert.equal(findPersistedSubmission({ requests: rows }, "missing"), null);
});

test("server failure messages preserve the backend reason and tell Staff their data remains", () => {
  const error = Object.assign(new Error("Secure request-letter storage is not enabled."), { status: 503 });
  const message = submissionFailureMessage(error, true);
  assert.match(message, /Secure request-letter storage/);
  assert.match(message, /entries are preserved/);
});
