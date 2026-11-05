import { Buffer } from "node:buffer";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const utility = readFileSync(new URL("../src/utils/requestLetterDownload.js", import.meta.url), "utf8");
const participant = readFileSync(new URL("../src/pages/MyRequestsPage.jsx", import.meta.url), "utf8");
const review = readFileSync(new URL("../src/pages/SeedlingRequestsPage.jsx", import.meta.url), "utf8");

test("private request and walk-in acknowledgement downloads use only their authenticated backend endpoints", async t => {
  const calls = [], revoked = [], anchors = [];
  const priorDocument = globalThis.document;
  globalThis.__privateDocumentRequest = async endpoint => { calls.push(endpoint); return { ok: true, blob: async () => new Blob(["private fixture"]) }; };
  globalThis.document = { createElement() { const anchor = { style: {}, click() { this.clicked = true; }, remove() {} }; anchors.push(anchor); return anchor; }, body: { appendChild() {} } };
  t.mock.method(URL, "createObjectURL", () => "blob:private-fixture"); t.mock.method(URL, "revokeObjectURL", value => revoked.push(value));
  t.after(() => { globalThis.document = priorDocument; delete globalThis.__privateDocumentRequest; });
  const moduleSource = utility.replace('import { authenticatedFetch } from "../services/authenticatedApi";', 'const authenticatedFetch = globalThis.__privateDocumentRequest;');
  const { downloadPrivateRequestLetter, downloadPrivateWalkInAcknowledgement } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);
  await downloadPrivateRequestLetter({ id: "authorized-request", requestLetter: { storageStatus: "private_v1", originalName: "letter.pdf" } });
  await downloadPrivateWalkInAcknowledgement({ id: "walk-in-request", walkIn: { acknowledgement: { storageStatus: "private_v1", originalName: "signed.png" } } });
  assert.deepEqual(calls, ["/seedling-requests/authorized-request/request-letter", "/seedling-requests/walk-in-request/acknowledgement"]);
  assert.ok(anchors.every(anchor => anchor.clicked && anchor.href === "blob:private-fixture")); assert.equal(revoked.length, 2);
  assert.doesNotMatch(utility, /firebasestorage|storage\.googleapis|downloadTokens|objectName|bucket/);
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
