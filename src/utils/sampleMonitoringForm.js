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
      if (value !== "" && value != null && (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(String(value).trim()) || !Number.isFinite(Number(value)) || Number(value) <= 0)) errors[key(field)] = "Enter a positive, finite measurement.";
    }
    if (submit && ["Healthy", "Damaged"].includes(row.condition)) {
      if (row.heightCentimeters === "" || row.heightCentimeters == null) errors[key("heightCentimeters")] = "Height is required for a living tree.";
      if (row.stemDiameterMillimeters === "" || row.stemDiameterMillimeters == null) errors[key("stemDiameterMillimeters")] = "Stem diameter is required for a living tree.";
    }
    if (row.mortalityCause && !MORTALITY_CAUSES.includes(row.mortalityCause)) errors[key("mortalityCause")] = "Select a configured Cause of Mortality.";
    if (submit && row.condition === "Dead") {
      if (!row.mortalityCause) errors[key("mortalityCause")] = "Select the Cause of Mortality.";
      if (!String(row.remarks || "").trim()) errors[key("remarks")] = "Describe the confirmed mortality observation.";
    }
    // Spec §15 and the backend require Individual Remarks for Needs Rechecking as well as the separate reason.
    if (row.condition === "Needs Rechecking" && !String(row.remarks || "").trim()) errors[key("remarks")] = "Describe the rechecking observation in Individual Remarks.";
    if (row.condition === "Needs Rechecking" && !String(row.recheckReason || "").trim()) errors[key("recheckReason")] = "Enter the Reason for Rechecking.";
    if (String(row.remarks || "").length > 1000) errors[key("remarks")] = "Use at most 1000 characters.";
    if (row.investigationOutcome && !String(row.searchFindings || "").trim()) errors[key("searchFindings")] = "Document the search findings.";
    if (String(row.searchFindings || "").length > 1000) errors[key("searchFindings")] = "Use at most 1000 characters.";
  }
  return errors;
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
export function sampleProgress(rows) {
  const count = condition => rows.filter(row => row.condition === condition).length;
  const healthy=count("Healthy"), damaged=count("Damaged"), dead=count("Dead"), rechecking=count("Needs Rechecking");
  return { healthy, damaged, dead, rechecking, living: healthy+damaged, assessed: healthy+damaged+dead+rechecking,
    total: rows.length, notAssessed: rows.length-healthy-damaged-dead-rechecking };
}
