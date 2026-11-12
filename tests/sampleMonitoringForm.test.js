import test from "node:test";
import assert from "node:assert/strict";
import { assessmentErrors, sampleProgress } from "../src/utils/sampleMonitoringForm.js";
const row=(sampleId,condition)=>({sampleId,condition,remarks:"",heightCentimeters:"",diameterCentimeters:"",searchFindings:"",investigationOutcome:""});
test("progress separates living, confirmed dead, unresolved and unassessed",()=>{assert.deepEqual(sampleProgress([row("a","Healthy"),row("b","Damaged"),row("c","Dead"),row("d","Needs Rechecking"),row("e","")]),{healthy:1,damaged:1,dead:1,rechecking:1,living:2,assessed:4,total:5,notAssessed:1});});
test("incomplete drafts are valid but incomplete final submissions are refused",()=>{assert.deepEqual(assessmentErrors([row("a","")],false),{});assert.ok(assessmentErrors([row("a","")],true)["a.condition"]);});
test("measurements reject negative, nonfinite and malformed values without fabricating zeros",()=>{for(const value of ["-1","Infinity","NaN","3 cm"])assert.ok(assessmentErrors([{...row("a","Healthy"),heightCentimeters:value}])["a.heightCentimeters"]);assert.deepEqual(assessmentErrors([{...row("a","Healthy"),heightCentimeters:"0",diameterCentimeters:"1.25"}]),{});});
test("rechecking requires remarks and investigation findings, never a Dead conversion",()=>{const item={...row("a","Needs Rechecking"),investigationOutcome:"Not Located After Rechecking"};const errors=assessmentErrors([item]);assert.ok(errors["a.remarks"]);assert.ok(errors["a.searchFindings"]);assert.equal(item.condition,"Needs Rechecking");});
