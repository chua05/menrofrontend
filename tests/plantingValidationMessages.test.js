import test from "node:test";
import assert from "node:assert/strict";
import { retainInvalidFieldMessages } from "../src/utils/formValidation.js";

test("Submit retains the exact photo verification failure while the photo is invalid", () => {
  const previous = { photos: "The original photo GPS metadata is incomplete or unreadable." };
  assert.deepEqual(retainInvalidFieldMessages({ photos: "Verify every photo before submitting." }, previous), previous);
});

test("corrected fields clear while other validation failures remain", () => {
  assert.deepEqual(retainInvalidFieldMessages({ remarks: "Remarks are required." }, { photos: "Missing GPS", remarks: "Review these remarks." }), { remarks: "Review these remarks." });
  assert.deepEqual(retainInvalidFieldMessages({}, { photos: "Missing GPS" }), {});
});

test("new failures and empty previous messages retain current validation text", () => {
  assert.deepEqual(retainInvalidFieldMessages({ photos: "Add a photo.", requestId: "Select a release." }, { photos: "  " }), { photos: "Add a photo.", requestId: "Select a release." });
});

test("validation messages are retained without mutating either error object", () => {
  const validation = Object.freeze({ photos: "Verify photo." }), previous = Object.freeze({ photos: "No GPS metadata." });
  assert.deepEqual(retainInvalidFieldMessages(validation, previous), { photos: "No GPS metadata." });
});
