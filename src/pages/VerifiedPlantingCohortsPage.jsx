import { useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "../services/authenticatedApi";
import { useAuth } from "../context/AuthContext";
import { planDistribution, resolveVerifiedPlantingCohortEnabled, visibleCohortMessage } from "../utils/verifiedPlantingCohort";
import "../styles/verified-planting-cohorts.css";

const emptyPlanSample = () => ({ permanentId: "", unitType: "tree", species: "", siteReference: "", selectionReason: "" });
const emptyBaseline = (sample = {}) => ({
  permanentId: sample.permanentId || "", unitType: sample.unitType || "tree", species: sample.species || "",
  latitude: "", longitude: "", condition: "Healthy", heightMeters: "", diameterCentimeters: "", remarks: "",
  captureDate: new Date().toISOString().slice(0, 10), photoEvidenceId: "",
});

async function api(path, options = {}) {
  const response = await authenticatedFetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.message || "The cohort action could not be completed.");
  return payload.data;
}

export default function VerifiedPlantingCohortsPage() {
  const { userRole } = useAuth();
  const enabled = resolveVerifiedPlantingCohortEnabled();
  const [cohorts, setCohorts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [planSamples, setPlanSamples] = useState([emptyPlanSample()]);
  const [selectionMethod, setSelectionMethod] = useState("documented-manual");
  const [notes, setNotes] = useState("");
  const [baselineUnits, setBaselineUnits] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => cohorts.find((cohort) => cohort.id === selectedId) || null, [cohorts, selectedId]);
  const target = Number(selected?.samplingPlan?.provisionalTarget || Math.max(0, Math.ceil(Number(selected?.verifiedPlantedQuantity || 0) * 0.1)));

  const reload = async () => {
    const data = await api("/verified-planting-cohorts");
    setCohorts(Array.isArray(data) ? data : []);
  };

  useEffect(() => { if (enabled) reload().catch((err) => setError(err.message)); }, [enabled]);
  useEffect(() => {
    if (!selected) return;
    const plan = selected.samplingPlan;
    setPlanSamples(plan?.selectedSamples?.length ? plan.selectedSamples : Array.from({ length: target || 1 }, emptyPlanSample));
    setSelectionMethod(plan?.selectionMethod || "documented-manual");
    setNotes(plan?.notes || "");
    setBaselineUnits(plan?.selectedSamples?.map(emptyBaseline) || []);
  }, [selectedId, selected?.samplingPlan?.version, target]);

  const savePlan = async (submitForApproval) => {
    if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/verified-planting-cohorts/${encodeURIComponent(selected.id)}/sampling-plan`, {
        method: "PUT", body: JSON.stringify({ expectedVersion: selected.samplingPlan?.version || 0, selectionMethod, selectedSamples: planSamples, speciesSiteDistribution: planDistribution(planSamples), notes, submitForApproval }),
      });
      await reload(); setMessage(submitForApproval ? "Sampling plan submitted for Admin approval." : "Sampling plan saved as a draft.");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const approvePlan = async () => {
    setBusy(true); setError("");
    try { await api(`/verified-planting-cohorts/${encodeURIComponent(selected.id)}/sampling-plan/approve`, { method: "POST", body: JSON.stringify({ expectedVersion: selected.samplingPlan.version, approve: true }) }); await reload(); setMessage("Sampling plan approved."); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const saveBaseline = async () => {
    setBusy(true); setError("");
    try {
      const sampleUnits = baselineUnits.map(({ photoEvidenceId, ...unit }) => ({ ...unit, photoReferences: photoEvidenceId ? [{ evidenceId: photoEvidenceId }] : [] }));
      await api(`/verified-planting-cohorts/${encodeURIComponent(selected.id)}/baseline`, { method: "PUT", body: JSON.stringify({ expectedVersion: selected.baselineVersion || 0, sampleUnits }) });
      await reload(); setMessage("Baseline submitted for Admin approval.");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const approveBaseline = async () => {
    setBusy(true); setError("");
    try { await api(`/verified-planting-cohorts/${encodeURIComponent(selected.id)}/baseline/approve`, { method: "POST", body: JSON.stringify({ expectedVersion: selected.baselineVersion, approve: true }) }); await reload(); setMessage("Baseline approved."); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (!enabled) return <main className="cohort-page"><h1>Verified Planting Cohorts</h1><p role="status">{visibleCohortMessage(false)}</p></main>;
  return <main className="cohort-page">
    <h1>Verified Planting Cohorts</h1>
    <p className="cohort-notice">Phase 2 test-only workflow. It does not change current survival-monitoring schedules, KPIs, or historical records.</p>
    {error && <p className="cohort-error" role="alert">{error}</p>}{message && <p className="cohort-success" role="status">{message}</p>}
    <label>Verified cohort<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select a cohort</option>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.id} — {cohort.verifiedPlantedQuantity} verified trees</option>)}</select></label>
    {selected && <>
      <section className="cohort-card"><h2>Sampling Plan</h2><p>Provisional target: <strong>{target}</strong> samples ({selected.samplingPlan?.provisionalPolicy || "test-only ceil(verified quantity × 10%)"}).</p>
      <label>Selection method<select value={selectionMethod} disabled={userRole !== "staff" || selected.samplingPlan?.status === "APPROVED"} onChange={(event) => setSelectionMethod(event.target.value)}><option value="documented-manual">Documented manual selection</option><option value="systematic">Systematic selection</option><option value="stratified">Stratified selection</option></select></label>
      {planSamples.map((sample, index) => <fieldset key={index}><legend>Sample {index + 1}</legend>{[["permanentId","Permanent ID"],["species","Species"],["siteReference","Site / plot reference"],["selectionReason","Selection note"]].map(([key,label]) => <label key={key}>{label}<input value={sample[key]} disabled={userRole !== "staff" || selected.samplingPlan?.status === "APPROVED"} onChange={(event) => setPlanSamples((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: event.target.value } : item))}/></label>)}<label>Unit type<select value={sample.unitType} disabled={userRole !== "staff" || selected.samplingPlan?.status === "APPROVED"} onChange={(event) => setPlanSamples((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, unitType: event.target.value } : item))}><option value="tree">Tree</option><option value="plot">Plot</option></select></label></fieldset>)}
      <label>Plan notes<textarea value={notes} disabled={userRole !== "staff" || selected.samplingPlan?.status === "APPROVED"} onChange={(event) => setNotes(event.target.value)} /></label>
      {userRole === "staff" && selected.samplingPlan?.status !== "APPROVED" && <p><button disabled={busy} onClick={() => savePlan(false)}>Save draft</button><button disabled={busy} onClick={() => savePlan(true)}>Submit plan for approval</button></p>}
      {userRole === "admin" && selected.samplingPlan?.status === "PENDING_ADMIN_APPROVAL" && <button disabled={busy} onClick={approvePlan}>Approve sampling plan</button>}
      <p>Status: {selected.samplingPlan?.status || "NOT STARTED"}</p></section>
      <section className="cohort-card"><h2>Staff Baseline</h2>{selected.samplingPlan?.status !== "APPROVED" ? <p>An Admin-approved sampling plan is required before baseline registration.</p> : <>{baselineUnits.map((unit, index) => <fieldset key={unit.permanentId}><legend>{unit.permanentId}</legend>{[["latitude","Latitude"],["longitude","Longitude"],["heightMeters","Height (m)"],["diameterCentimeters","Diameter (cm)"],["photoEvidenceId","Baseline photo evidence ID"],["captureDate","Capture date"],["remarks","Remarks"]].map(([key,label]) => <label key={key}>{label}<input type={key === "captureDate" ? "date" : "text"} value={unit[key]} disabled={userRole !== "staff" || selected.baseline?.approvalStatus === "APPROVED"} onChange={(event) => setBaselineUnits((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: event.target.value } : item))}/></label>)}<label>Condition<select value={unit.condition} disabled={userRole !== "staff" || selected.baseline?.approvalStatus === "APPROVED"} onChange={(event) => setBaselineUnits((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, condition: event.target.value } : item))}>{["Healthy","Damaged","Dead","Unknown"].map((condition) => <option key={condition}>{condition}</option>)}</select></label></fieldset>)}
      {userRole === "staff" && selected.baseline?.approvalStatus !== "APPROVED" && <button disabled={busy} onClick={saveBaseline}>Submit baseline for approval</button>}
      {userRole === "admin" && selected.baseline?.approvalStatus === "PENDING_ADMIN_APPROVAL" && <button disabled={busy} onClick={approveBaseline}>Approve baseline</button>}
      <p>Status: {selected.baseline?.approvalStatus || selected.baselineStatus || "NOT STARTED"}</p></>}</section>
    </>}
  </main>;
}
