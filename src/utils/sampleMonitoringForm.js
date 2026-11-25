export const SAMPLE_CONDITIONS = ["Healthy", "Damaged", "Dead", "Needs Rechecking"];
export const MORTALITY_CAUSES = ["Unknown", "Drought", "Pest/Disease", "Flooding", "Physical Damage"];
export function assessmentErrors(rows, submit = false) {
  const errors = {};
  for (const row of rows) {
    // An approved confirmed death carried forward is locked and read-only: it is never re-validated,
    // so its hidden mortality fields can neither block a save nor receive focus.
    if (row.inheritedConfirmedDead) continue;
    const key = field => `${row.sampleId}.${field}`;
    if ((submit || row.condition) && !SAMPLE_CONDITIONS.includes(row.condition)) errors[key("condition")] = "Select the tree condition.";
    for (const field of ["heightCentimeters", "stemDiameterMillimeters"]) {
      const value = row[field];
      if (value !== "" && value != null && (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(String(value).trim()) || !Number.isFinite(Number(value)) || Number(value) <= 0)) errors[key(field)] = field === "heightCentimeters" ? "Height must be greater than 0." : "Stem diameter must be greater than 0.";
    }
    if (submit && ["Healthy", "Damaged"].includes(row.condition)) {
      if (row.heightCentimeters === "" || row.heightCentimeters == null) errors[key("heightCentimeters")] = "Enter the tree height.";
      if (row.stemDiameterMillimeters === "" || row.stemDiameterMillimeters == null) errors[key("stemDiameterMillimeters")] = "Enter the stem diameter.";
    }
    if (row.mortalityCause && !MORTALITY_CAUSES.includes(row.mortalityCause)) errors[key("mortalityCause")] = "Select a configured Cause of Mortality.";
    if (submit && row.condition === "Dead") {
      if (!row.mortalityCause) errors[key("mortalityCause")] = "Select the Cause of Mortality.";
      if (!String(row.remarks || "").trim()) errors[key("remarks")] = "Describe the confirmed mortality observation.";
    }
    // Spec §15 and the backend require Individual Remarks for Needs Rechecking as well as the separate reason.
    if (submit && row.condition === "Needs Rechecking" && !String(row.remarks || "").trim()) errors[key("remarks")] = "Describe the rechecking observation in Individual Remarks.";
    if (submit && row.condition === "Needs Rechecking" && !String(row.recheckReason || "").trim()) errors[key("recheckReason")] = "Enter the Reason for Rechecking.";
    if (String(row.remarks || "").length > 1000) errors[key("remarks")] = "Use at most 1000 characters.";
    if (submit && row.investigationOutcome && !String(row.searchFindings || "").trim()) errors[key("searchFindings")] = "Document the search findings.";
    if (String(row.searchFindings || "").length > 1000) errors[key("searchFindings")] = "Use at most 1000 characters.";
  }
  return errors;
}
export const PHOTO_REQUIRED = "Monitoring photo is required.";
export const PHOTO_UNVERIFIED = "Verify this photo's location, or remove it, before saving.";
export const DATE_INVALID = "Select a valid monitoring date.";
// Top-to-bottom order of the form, so the first invalid field is the one Staff see first.
const FIELD_ORDER = ["evidence", "heightCentimeters", "stemDiameterMillimeters", "condition", "mortalityCause", "remarks", "recheckReason", "searchFindings", "question"];
const fieldOf = key => key.slice(key.lastIndexOf(".") + 1), treeOf = key => key.slice(0, key.lastIndexOf("."));
export const hasTreeErrors = (errors, sampleId) => Object.entries(errors).some(([key, message]) => message && key !== "dateMonitored" && treeOf(key) === sampleId);
// The date is first, then the tree Staff are working on, then the other trees in their listed order.
export function firstInvalidField(errors, sampleIds = [], activeTreeId = "") {
  const keys = Object.keys(errors).filter(key => errors[key]);
  if (keys.includes("dateMonitored")) return "dateMonitored";
  const tree = id => (id === activeTreeId ? -1 : sampleIds.indexOf(id));
  return keys.sort((a, b) => tree(treeOf(a)) - tree(treeOf(b)) || FIELD_ORDER.indexOf(fieldOf(a)) - FIELD_ORDER.indexOf(fieldOf(b)))[0] || "";
}
// Errors after one field changed: the changed field is checked at once, an already reported field stays reported until it is
// valid, and a field the new condition no longer uses loses its error. Other trees are never touched.
export function errorsAfterChange(errors, row, field) {
  const relaxed = assessmentErrors([row]), strict = assessmentErrors([row], true), next = { ...errors };
  for (const name of FIELD_ORDER) {
    if (name === "evidence" || name === "question" || field !== "condition" && name !== field) continue;
    const key = `${row.sampleId}.${name}`;
    next[key] = relaxed[key] || (errors[key] ? strict[key] : "") || "";
  }
  return next;
}
const SERVER_MESSAGE = { TREE_CONDITION_REQUIRED: "Select the tree condition.", CURRENT_SAMPLE_EVIDENCE_REQUIRED: PHOTO_REQUIRED, INVALID_DATE_MONITORED: DATE_INVALID,
  ORIGINAL_REPLACEMENT_REQUIRED: "This assessment or its monitoring date changed after the photo was verified. Add a new photo." };
const SERVER_CODE_FIELD = { TREE_CONDITION_REQUIRED: "condition", CURRENT_SAMPLE_EVIDENCE_REQUIRED: "evidence", ORIGINAL_REPLACEMENT_REQUIRED: "evidence", INVALID_ASSESSED_ON: "evidence" };
// Backend refusals shown below their own field. An empty result means the refusal concerns the whole form.
export function serverFieldErrors(error = {}, rows = []) {
  if (["INVALID_DATE_MONITORED", "VISIT_NOT_OPEN", "VISIT_BEFORE_ELIGIBILITY"].includes(error.code)) return { dateMonitored: SERVER_MESSAGE[error.code] || error.message };
  const field = SERVER_CODE_FIELD[error.code] || error.field;
  if (!FIELD_ORDER.includes(field)) return {};
  const ids = error.missingSampleIds?.length ? error.missingSampleIds : error.sampleId ? [error.sampleId] : [];
  return Object.assign({}, ...ids.map(id => rows.find(row => row.sampleId === id)).filter(Boolean).map(row => {
    const key = `${row.sampleId}.${field}`;
    return { [key]: SERVER_MESSAGE[error.code] || assessmentErrors([row], true)[key] || error.message };
  }));
}
// Fields Staff edit on a tree; used to keep other trees' unsaved local edits after a single-tree save.
export const EDITABLE_ASSESSMENT_FIELDS = ["condition", "remarks", "heightCentimeters", "stemDiameterMillimeters", "mortalityCause", "recheckReason", "investigationOutcome", "searchFindings"];
// After a confirmed Save Tree Assessment (direct or reconciled after a timeout), only the saved tree takes the
// server-confirmed values. Every other tree keeps its local edits, which stay marked Unsaved (spec §17).
// Without `savedSampleId` (Save Draft / Submit sent every row) the server rows are authoritative.
export function keepUnsavedEdits(serverRows, localRows, savedSampleId = "") {
  return serverRows.map(row => {
    const local = savedSampleId && row.sampleId !== savedSampleId && localRows.find(item => item.sampleId === row.sampleId);
    return local ? { ...row, ...Object.fromEntries(EDITABLE_ASSESSMENT_FIELDS.map(field => [field, local[field]])) } : row;
  });
}
// A tree has its photo when evidence of the current assessment revision is stored; an approved carried-forward death needs none.
export const hasCurrentEvidence = row => Boolean(row?.inheritedConfirmedDead) ||
  (row?.evidenceHistory || []).some(entry => Number(entry?.revision || 0) === Number(row?.assessmentRevision || 0));
// Difference from the previous approved measurement while the form is being filled in. The server recalculates it on save.
export function growthPreview(row, previous) {
  const number = value => (value === "" || value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value));
  const before = { height: number(previous?.heightCentimeters),
    diameter: number(previous?.stemDiameterMillimeters ?? (previous?.diameterCentimeters == null ? null : Number(previous.diameterCentimeters) * 10)) };
  const difference = (current, earlier) => (current === null || earlier === null ? null : Number((current - earlier).toFixed(4)));
  const living = ["Healthy", "Damaged"].includes(row?.condition);
  const height = living ? difference(number(row?.heightCentimeters), before.height) : null;
  const diameter = living ? difference(number(row?.stemDiameterMillimeters), before.diameter) : null;
  return { height, diameter, decreased: height < 0 || diameter < 0 };
}
export function sampleProgress(rows) {
  const count = condition => rows.filter(row => row.condition === condition).length;
  const healthy=count("Healthy"), damaged=count("Damaged"), dead=count("Dead"), rechecking=count("Needs Rechecking");
  return { healthy, damaged, dead, rechecking, living: healthy+damaged, assessed: healthy+damaged+dead+rechecking,
    total: rows.length, notAssessed: rows.length-healthy-damaged-dead-rechecking };
}
