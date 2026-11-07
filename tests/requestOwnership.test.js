import assert from "node:assert/strict";
import test from "node:test";
import { ownsSeedlingRequest, canProcessSeedlingRequest } from "../src/utils/requestOwnership.js";

test("My Requests means requester ownership, never encoder identity", () => {
  const assisted = { participantId: "citizen", walkIn: { encodedBy: "staff" } };
  assert.equal(ownsSeedlingRequest(assisted, { uid: "staff" }), false);
  assert.equal(ownsSeedlingRequest({ participantId: "staff" }, { uid: "staff" }), true);
  assert.equal(ownsSeedlingRequest(assisted, null), false);
});
test("self and assisted-encoder processing controls stay unavailable across role changes", () => {
  const assisted = { participantId: "citizen", walkIn: { encodedBy: "encoder" } };
  for (const role of ["staff", "admin"]) {
    for (const uid of ["citizen", "encoder"]) assert.equal(canProcessSeedlingRequest(assisted, { uid, role }), false);
    assert.equal(canProcessSeedlingRequest(assisted, { uid: "independent", role }), true);
  }
});
