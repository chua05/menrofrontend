export const SAMPLE_CONDITIONS = ["Healthy", "Damaged", "Dead", "Needs Rechecking"];
export function assessmentErrors(rows, submit = false) {
  const errors = {};
  for (const row of rows) {
    const key = field => `${row.sampleId}.${field}`;
    if ((submit || row.condition) && !SAMPLE_CONDITIONS.includes(row.condition)) errors[key("condition")] = "Select the tree condition.";
    for (const field of ["heightCentimeters", "diameterCentimeters"]) {
      const value = row[field];
      if (value !== "" && value != null && (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(String(value).trim()) || !Number.isFinite(Number(value)) || Number(value) < 0)) errors[key(field)] = "Enter a finite, nonnegative measurement.";
    }
    if (row.condition === "Needs Rechecking" && !row.remarks.trim()) errors[key("remarks")] = "Explain why this tree needs rechecking.";
    if (row.remarks.length > 1000) errors[key("remarks")] = "Use at most 1000 characters.";
    if (row.investigationOutcome && !row.searchFindings.trim()) errors[key("searchFindings")] = "Document the search findings.";
    if (row.searchFindings.length > 1000) errors[key("searchFindings")] = "Use at most 1000 characters.";
  }
  return errors;
}
export function sampleProgress(rows) {
  const count = condition => rows.filter(row => row.condition === condition).length;
  const healthy=count("Healthy"), damaged=count("Damaged"), dead=count("Dead"), rechecking=count("Needs Rechecking");
  return { healthy, damaged, dead, rechecking, living: healthy+damaged, assessed: healthy+damaged+dead+rechecking,
    total: rows.length, notAssessed: rows.length-healthy-damaged-dead-rechecking };
}
