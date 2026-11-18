// Approval snapshots preserve unresolved requirements; pending is never an exemption.
export const PENDING_MENRO_POLICY = "PENDING_MENRO_POLICY";
export function approvedPolicyLabel(snapshot) {
  if (!snapshot) return "";
  if (snapshot.policyStatus === PENDING_MENRO_POLICY || snapshot.definition?.reporting === PENDING_MENRO_POLICY || snapshot.definition?.monitoring === PENDING_MENRO_POLICY) return "Pending MENRO policy decision";
  const text = { REQUIRED: "Report required", OPTIONAL: "Report optional", NOT_REQUIRED: "No report required", CONDITIONAL: "Conditional reporting",
    NONE: "No monitoring", STAFF_SPOT_CHECK: "Staff spot-check", PERMANENT_SAMPLE: "Permanent-sample monitoring" };
  return `${text[snapshot.definition?.reporting] || "Reporting not recorded"} ? ${text[snapshot.definition?.monitoring] || "Monitoring not recorded"}${snapshot.override ? " (Admin decision)" : ""}`;
}
