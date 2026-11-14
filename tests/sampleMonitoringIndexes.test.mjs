import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Backend sampleMonitoringVisit.service list(): optional equality filters, then
// orderBy(visitDate desc).orderBy(__name__ asc). Admin = no createdBy filter;
// Staff = createdBy; pilot = cohortId IN; status filter is optional.
const indexes = JSON.parse(readFileSync(new URL("../firestore.indexes.json", import.meta.url), "utf8")).indexes
  .filter(index => index.collectionGroup === "sampleMonitoringVisits" && index.queryScope === "COLLECTION");
const covers = (equality) => indexes.some(({ fields }) => {
  const tail = fields.slice(-2).map(f => `${f.fieldPath}:${f.order}`).join(",");
  const head = fields.slice(0, -2);
  return tail === "visitDate:DESCENDING,__name__:ASCENDING" && head.length === equality.length
    && head.every(f => f.order === "ASCENDING" && equality.includes(f.fieldPath));
});

test("every sample-monitoring visit list query shape has a declared composite index", () => {
  for (const cohort of [[], ["cohortId"]]) for (const owner of [[], ["createdBy"]]) for (const status of [[], ["status"]]) {
    const equality = [...cohort, ...owner, ...status];
    assert.ok(covers(equality), `missing index for filters [${equality.join(", ") || "none (Admin list)"}]`);
  }
});

test("the unfiltered Admin list index is declared exactly as Firestore requests it", () => {
  assert.ok(covers([]), "Admin list needs sampleMonitoringVisits (visitDate DESC, __name__ ASC)");
});
