import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const manifest = JSON.parse(readFileSync(new URL("../firestore.indexes.json", import.meta.url), "utf8"));
const signature = index => `${index.collectionGroup}:${index.fields.map(field => `${field.fieldPath}/${field.order}`).join(",")}`;
test("index manifest covers recipient/visit inbox ordering and every role/status discovery shape", () => {
  const signatures = new Set(manifest.indexes.map(signature));
  for (const equality of ["recipientUserId", "visitId"]) {
    assert.ok(signatures.has(`sampleMonitoringInformationRequests:${equality}/ASCENDING,createdAt/DESCENDING`));
  }
  for (const equalities of [[], ["status"], ["createdBy"], ["createdBy", "status"]]) {
    const fields = [...equalities.map(field => `${field}/ASCENDING`), "visitDate/DESCENDING", "__name__/ASCENDING"].join(",");
    assert.ok(signatures.has(`sampleMonitoringVisits:${fields}`));
  }
  assert.equal(signatures.size, manifest.indexes.length);
  assert.ok(manifest.indexes.every(index => index.queryScope === "COLLECTION"));
});
test("all three existing notification indexes and field overrides remain intact", () => {
  const signatures = manifest.indexes.filter(index => index.collectionGroup === "notifications").map(signature);
  assert.deepEqual(signatures, [
    "notifications:recipientUserId/ASCENDING,createdAt/DESCENDING",
    "notifications:recipientUserId/ASCENDING,isRead/ASCENDING",
    "notifications:recipientUserId/ASCENDING,isRead/ASCENDING,createdAt/DESCENDING",
  ]);
  assert.deepEqual(manifest.fieldOverrides, []);
});

test("pilot cohort constraints retain ordered discovery, requester inbox and analytics filtering indexes", () => {
  const signatures = new Set(manifest.indexes.map(signature));
  for (const equalities of [[], ["status"], ["createdBy"], ["createdBy", "status"]]) {
    const fields = ["cohortId/ASCENDING", ...equalities.map(field => `${field}/ASCENDING`), "visitDate/DESCENDING", "__name__/ASCENDING"].join(",");
    assert.ok(signatures.has(`sampleMonitoringVisits:${fields}`));
  }
  assert.ok(signatures.has("sampleMonitoringInformationRequests:cohortId/ASCENDING,recipientUserId/ASCENDING,createdAt/DESCENDING"));
  for (const owner of [false, true]) for (const site of [false, true]) {
    const fields = ["cohortId/ASCENDING", "status/ASCENDING", ...(owner ? ["createdBy/ASCENDING"] : []), ...(site ? ["siteId/ASCENDING"] : []), "__name__/ASCENDING"].join(",");
    assert.ok(signatures.has(`sampleMonitoringVisits:${fields}`));
  }
});
