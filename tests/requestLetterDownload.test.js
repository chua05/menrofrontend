import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const utility = readFileSync(new URL("../src/utils/requestLetterDownload.js", import.meta.url), "utf8");
const participant = readFileSync(new URL("../src/pages/MyRequestsPage.jsx", import.meta.url), "utf8");
const review = readFileSync(new URL("../src/pages/SeedlingRequestsPage.jsx", import.meta.url), "utf8");

test("private request-letter downloads use only the authenticated backend endpoint", () => {
  assert.match(utility, /authenticatedFetch\(`\/seedling-requests\/\$\{encodeURIComponent\(request\.id\)\}\/request-letter`\)/);
  assert.doesNotMatch(utility, /firebasestorage|storage\.googleapis|downloadTokens|objectName|bucket/);
  assert.match(utility, /response\.blob\(\)/);
  assert.match(utility, /URL\.revokeObjectURL\(url\)/);
});

test("participant and staff/admin detail views expose downloads only for real private documents", () => {
  assert.match(utility, /storageStatus === "private_v1"/);
  for (const source of [participant, review]) {
    assert.match(source, /hasPrivateRequestLetter\(selectedRequest\)/);
    assert.match(source, /downloadPrivateRequestLetter\(selectedRequest\)/);
  }
  assert.doesNotMatch(participant, /requestLetter\.objectName|requestLetter\.bucket/);
  assert.doesNotMatch(review, /requestLetter\.objectName|requestLetter\.bucket/);
});
