import { useState } from "react";
import { authenticatedFetch } from "../services/authenticatedApi";
export default function SamplingPolicyReadiness({ cohort, role, onSaved }) {
  const [attested, setAttested] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const readiness = cohort.samplingReadiness;
  if (!cohort.samplingPolicySnapshot) return null;
  async function approve() {
    if (!attested || busy) return;
    setBusy(true); setError("");
    try {
      const response = await authenticatedFetch(`/verified-planting-cohorts/${encodeURIComponent(cohort.id)}/sampling-plan/approve`, { method: "POST", body: JSON.stringify({ expectedVersion: cohort.samplingPlan.version, approve: true, estimationEligibilityApproved: true }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.message || "Sampling approval failed."); await onSaved();
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section className="cohort-card"><h2>Approved Purpose / Sampling Policy Readiness</h2><p>Confirmed planted: {cohort.verifiedPlantedQuantity}. Base target at {readiness?.percentage}%: {readiness?.baseTarget}. Final target: {readiness?.target ?? "Pending approved minimum"}.</p>
    <p>First visit: {readiness?.firstVisitDueDate || "Pending approved first-visit delay"}. Later interval: {readiness?.intervalMonths} months for this new cohort. Automatic sample/visit creation remains disabled.</p>
    {readiness?.pending?.length > 0 && <p role="status">MENRO decisions pending: {readiness.pending.join(", ")}. No automatic species allocation or random selection is inferred.</p>}
    {role === "admin" && cohort.samplingPlan?.status === "PENDING_ADMIN_APPROVAL" && Array.isArray(readiness?.pending) && !readiness.pending.length && <><label><input type="checkbox" checked={attested} onChange={event => setAttested(event.target.checked)} />I reviewed the documented species allocation and physical random selection against the approved procedures. These permanent trees are eligible for clearly labeled estimates.</label><button type="button" disabled={!attested || busy} onClick={approve}>{busy ? "Approving…" : "Approve Sampling Plan and Validity"}</button></>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
