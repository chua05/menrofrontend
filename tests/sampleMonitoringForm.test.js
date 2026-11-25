import test from "node:test";
import assert from "node:assert/strict";
import { assessmentErrors, sampleProgress } from "../src/utils/sampleMonitoringForm.js";
const row=(sampleId,condition)=>({sampleId,condition,remarks:"",heightCentimeters:"",stemDiameterMillimeters:"",mortalityCause:"",recheckReason:"",searchFindings:"",investigationOutcome:""});
test("progress separates living, confirmed dead, unresolved and unassessed",()=>{assert.deepEqual(sampleProgress([row("a","Healthy"),row("b","Damaged"),row("c","Dead"),row("d","Needs Rechecking"),row("e","")]),{healthy:1,damaged:1,dead:1,rechecking:1,living:2,assessed:4,total:5,notAssessed:1});});
test("incomplete drafts are valid but incomplete final submissions are refused",()=>{assert.deepEqual(assessmentErrors([row("a","")],false),{});assert.ok(assessmentErrors([row("a","")],true)["a.condition"]);});
test("measurements require positive finite values without fabricating zeros",()=>{for(const value of ["-1","0","Infinity","NaN","3 cm"])assert.ok(assessmentErrors([{...row("a","Healthy"),heightCentimeters:value}])["a.heightCentimeters"]);assert.deepEqual(assessmentErrors([{...row("a","Healthy"),heightCentimeters:"1",stemDiameterMillimeters:"12.5"}]),{});});
test("rechecking requires its separate reason and investigation findings, never a Dead conversion",()=>{const item={...row("a","Needs Rechecking"),investigationOutcome:"Not Located After Rechecking"};const errors=assessmentErrors([item],true);assert.deepEqual(assessmentErrors([item]),{},"a draft may be incomplete");assert.ok(errors["a.recheckReason"]);assert.ok(errors["a.searchFindings"]);assert.equal(item.condition,"Needs Rechecking");});
test("submission requires living measurements and complete mortality details",()=>{const living=assessmentErrors([row("a","Healthy")],true);assert.ok(living["a.heightCentimeters"]);assert.ok(living["a.stemDiameterMillimeters"]);const dead=assessmentErrors([row("b","Dead")],true);assert.ok(dead["b.mortalityCause"]);assert.ok(dead["b.remarks"]);});
test("D-1: an inherited confirmed-dead row is locked, so missing cause/remarks never block save or submit",()=>{const inherited={...row("a","Dead"),inheritedConfirmedDead:{visitId:"V1",assessmentRevision:0}};assert.deepEqual(assessmentErrors([inherited],true),{});assert.deepEqual(assessmentErrors([inherited],false),{});const fresh=assessmentErrors([row("b","Dead")],true);assert.ok(fresh["b.mortalityCause"]);assert.ok(fresh["b.remarks"]);});
test("D-9: Needs Rechecking requires Individual Remarks as well as the Reason for Rechecking (backend and spec §15)",()=>{const missing=assessmentErrors([row("a","Needs Rechecking")],true);assert.ok(missing["a.remarks"]);assert.ok(missing["a.recheckReason"]);assert.deepEqual(assessmentErrors([{...row("a","Needs Rechecking"),remarks:"Tag not visible",recheckReason:"Confirm on next visit"}]),{});});

test("M3: keepUnsavedEdits confirms only the saved tree and keeps other trees' local unsaved edits", async () => {
  const { keepUnsavedEdits } = await import("../src/utils/sampleMonitoringForm.js");
  const server = [{ ...row("TREE-A", "Healthy"), heightCentimeters: 100, assessmentRevision: 0 }, { ...row("TREE-B", "Damaged"), heightCentimeters: 80, stemDiameterMillimeters: 35, assessmentRevision: 1 }];
  const local = [{ ...row("TREE-A", "Healthy"), heightCentimeters: "130", remarks: "Local unsaved" }, { ...row("TREE-B", "Damaged"), heightCentimeters: "80", stemDiameterMillimeters: "35" }];
  const merged = keepUnsavedEdits(server, local, "TREE-B");
  assert.equal(merged[0].heightCentimeters, "130", "TREE-A keeps its unsaved local height");
  assert.equal(merged[0].remarks, "Local unsaved");
  assert.equal(merged[0].assessmentRevision, 0, "non-edited server fields still come from the server");
  assert.deepEqual(merged[1], server[1], "the saved tree takes the server-confirmed state");
  // Save Draft / Submit sent every row: the server rows are authoritative.
  assert.deepEqual(keepUnsavedEdits(server, local, ""), server);
});

test("growth is previewed from the previous approved measurement for living trees only, and a decrease is flagged", async () => {
  const { growthPreview, hasCurrentEvidence } = await import("../src/utils/sampleMonitoringForm.js");
  const previous = { heightCentimeters: 45, stemDiameterMillimeters: 6 };
  assert.deepEqual(growthPreview({ condition: "Healthy", heightCentimeters: "61", stemDiameterMillimeters: "8" }, previous), { height: 16, diameter: 2, decreased: false });
  assert.deepEqual(growthPreview({ condition: "Damaged", heightCentimeters: "44.5", stemDiameterMillimeters: "" }, previous), { height: -0.5, diameter: null, decreased: true });
  // Centimetre records are converted, never read as millimetres.
  assert.equal(growthPreview({ condition: "Healthy", heightCentimeters: "", stemDiameterMillimeters: "8" }, { diameterCentimeters: 0.6 }).diameter, 2);
  for (const condition of ["Dead", "Needs Rechecking", ""]) assert.deepEqual(growthPreview({ condition, heightCentimeters: "61", stemDiameterMillimeters: "8" }, previous), { height: null, diameter: null, decreased: false });
  assert.deepEqual(growthPreview({ condition: "Healthy", heightCentimeters: "61" }, null), { height: null, diameter: null, decreased: false });
  assert.equal(hasCurrentEvidence({ assessmentRevision: 1, evidenceHistory: [{ revision: 0 }] }), false);
  assert.equal(hasCurrentEvidence({ assessmentRevision: 1, evidenceHistory: [{ revision: 0 }, { revision: 1 }] }), true);
  assert.equal(hasCurrentEvidence({ inheritedConfirmedDead: { visitId: "V1" } }), true);
});
