import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wizard = readFileSync(
  new URL("../src/pages/ParticipantSaplingRequestWizard.jsx", import.meta.url),
  "utf8",
);
const requestsPage = readFileSync(
  new URL("../src/pages/MyRequestsPage.jsx", import.meta.url),
  "utf8",
);

test("submission navigation carries the backend request reference", () => {
  assert.match(wizard, /const requestReference = savedRequest\?\.requestNumber \|\| savedRequest\?\.id/);
  assert.match(wizard, /submittedRequestReference: requestReference/);
});

test("destination toast waits for loading and the submitted request", () => {
  assert.match(requestsPage, /if \(!message \|\| loading \|\| loadError\) return/);
  assert.match(requestsPage, /submittedRequestIsLoaded/);
  assert.match(requestsPage, /if \(!submittedRequestIsLoaded\) return/);
  assert.match(requestsPage, /replace: true, state: null/);
});
