import { Link } from "react-router-dom";
import { sampleAnalyticsEnabled } from "../utils/permanentSampleFeatures";
import SamplingPolicyReadiness from "../components/SamplingPolicyReadiness";
import { useEffect, useMemo, useRef, useState } from "react";
import { authenticatedFetch } from "../services/authenticatedApi";
import { useAuth } from "../context/AuthContext";
import { planDistribution, resolveVerifiedPlantingCohortEnabled, visibleCohortMessage } from "../utils/verifiedPlantingCohort";
import SecureCameraCapture from "../components/SecureCameraCapture";
import "../styles/verified-planting-cohorts.css";

const emptyPlanSample = () => ({ permanentId: "", unitType: "tree", species: "", siteReference: "", selectionReason: "" });
const emptyBaseline = (sample = {}) => ({
  permanentId: sample.permanentId || "", unitType: sample.unitType || "tree", species: sample.species || "",
  latitude: "", longitude: "", condition: "Healthy", heightMeters: "", diameterCentimeters: "", remarks: "",
  captureDate: new Date().toISOString().slice(0, 10),
});

async function api(path, options = {}) {
  const response = await authenticatedFetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.message || "The cohort action could not be completed.");
  return payload.data;
}

export default function VerifiedPlantingCohortsPage({ embedded = false, view = "all" }) {
  const Container = embedded ? "section" : "main";
  const Heading = embedded ? "h2" : "h1";
  const { userRole } = useAuth();
  const enabled = resolveVerifiedPlantingCohortEnabled();
  const [cohorts, setCohorts] = useState([]);
  const [cohortsLoading, setCohortsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [planSamples, setPlanSamples] = useState([emptyPlanSample()]);
  const [selectionMethod, setSelectionMethod] = useState("documented-manual");
  const [notes, setNotes] = useState("");
  const [baselineUnits, setBaselineUnits] = useState([]);
  const [baselinePhotos, setBaselinePhotos] = useState({});
  const [storedPhotoUrls, setStoredPhotoUrls] = useState({});
  const [cameraSampleId, setCameraSampleId] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const baselineAttemptKey = useRef("");

  const selected = useMemo(() => cohorts.find((cohort) => cohort.id === selectedId) || null, [cohorts, selectedId]);
  const target = selected?.samplingPolicySnapshot ? Number(selected.samplingReadiness?.target ?? 0) : Number(selected?.samplingPlan?.provisionalTarget || Math.max(0, Math.ceil(Number(selected?.verifiedPlantedQuantity || 0) * 0.1)));
  const samplingBlocked = Boolean(selected?.samplingPolicySnapshot && (!selected.samplingReadiness || selected.samplingReadiness.pending?.length));
  const selectedBaseline = selected?.baseline?.sampleUnits;
  const selectedPlan = selected?.samplingPlan || null;
  const selectedSamples = selectedPlan?.selectedSamples;
  const selectedMethod = selectedPlan?.selectionMethod || "documented-manual";
  const selectedNotes = selectedPlan?.notes || "";
  const hasSamplingPolicySnapshot = Boolean(selected?.samplingPolicySnapshot);
  const hasSelectedCohort = Boolean(selected);

  const loadCohorts = async () => {
    const data = await api("/verified-planting-cohorts");
    return Array.isArray(data) ? data : [];
  };
  const reload = async () => setCohorts(await loadCohorts());

  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    loadCohorts().then((data) => { if (current) setCohorts(data); })
      .catch((err) => { if (current) setError(err.message); }).finally(() => { if (current) setCohortsLoading(false); });
    return () => { current = false; };
  }, [enabled]);
  useEffect(() => {
    if (!hasSelectedCohort) return;
    const frame = window.requestAnimationFrame(() => {
      setPlanSamples(selectedSamples?.length ? selectedSamples : Array.from({ length: hasSamplingPolicySnapshot ? target : target || 1 }, emptyPlanSample));
      setSelectionMethod(selectedMethod);
      setNotes(selectedNotes);
      setBaselineUnits(selectedSamples?.map(sample => ({ ...emptyBaseline(sample), ...(selectedBaseline?.find(unit => unit.permanentId === sample.permanentId) || {}) })) || []);
      setBaselinePhotos({});
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasSelectedCohort, selectedId, selectedPlan?.version, selectedSamples, selectedMethod, selectedNotes, hasSamplingPolicySnapshot, target, selectedBaseline]);

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
      if (baselineUnits.some((unit) => !baselinePhotos[unit.permanentId])) throw new Error("Capture one verified baseline photo for every selected sample.");
      if (!baselineAttemptKey.current) baselineAttemptKey.current = crypto.randomUUID();
      const form = new FormData();
      form.append("expectedVersion", String(selected.baselineVersion || 0));
      form.append("sampleUnits", JSON.stringify(baselineUnits));
      form.append("evidenceManifest", JSON.stringify(baselineUnits.map((unit) => ({ ...baselinePhotos[unit.permanentId].descriptor, sampleId: unit.permanentId }))));
      baselineUnits.forEach((unit) => form.append("photos", baselinePhotos[unit.permanentId].file));
      const response = await authenticatedFetch(`/verified-planting-cohorts/${encodeURIComponent(selected.id)}/baseline`, { method: "PUT", body: form, headers: { "Idempotency-Key": baselineAttemptKey.current } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.message || "Baseline submission could not be completed.");
      baselineAttemptKey.current = "";
      await reload(); setMessage("Baseline submitted for Admin approval.");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const approveBaseline = async () => {
    setBusy(true); setError("");
    try { await api(`/verified-planting-cohorts/${encodeURIComponent(selected.id)}/baseline/approve`, { method: "POST", body: JSON.stringify({ expectedVersion: selected.baselineVersion, approve: true }) }); await reload(); setMessage("Baseline approved."); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const cameraBinding = useMemo(() => ({ workflow: "cohort-baseline", cohortId: selected?.id || "",
    siteId: selected?.source?.siteId || "", sampleId: cameraSampleId,
    samplingPlanVersion: selected?.samplingPlan?.version || 0 }), [selected, cameraSampleId]);

  const cameraRequest = async (path, options) => ({ data: await api(path, options) });

  const attachBaselinePhoto = ({ file, descriptor, previewUrl, location }) => {
    if (!cameraSampleId) return;
    setBaselinePhotos((previous) => ({ ...previous, [cameraSampleId]: { file, descriptor, previewUrl, location } }));
    setBaselineUnits((items) => items.map((item) => item.permanentId === cameraSampleId
      ? { ...item, latitude: String(location.latitude), longitude: String(location.longitude), captureDate: new Date().toISOString().slice(0, 10) }
      : item));
    setCameraOpen(false); setCameraSampleId(""); setMessage("Verified baseline photo attached. It will be stored only when the baseline is submitted.");
  };

  const viewStoredPhoto = async (sampleId, photo, index) => {
    void photo;
    const key = `${selected.id}:${sampleId}:${index}`;
    if (storedPhotoUrls[key]) return;
    try {
      const response = await authenticatedFetch(`/evidence/verified-planting-cohorts/${encodeURIComponent(selected.id)}/baseline/${encodeURIComponent(sampleId)}/photos/${index}`);
      if (!response.ok) throw new Error("The stored baseline photo is unavailable.");
      const objectUrl = URL.createObjectURL(await response.blob());
      setStoredPhotoUrls((previous) => ({ ...previous, [key]: objectUrl }));
    } catch (err) { setError(err.message); }
  };

  if (!enabled) return <main className="cohort-page"><h1>Verified Planting Cohorts</h1><p role="status">{visibleCohortMessage(false)}</p></main>;
  return <Container className="cohort-page">
    <Heading>Verified Planting Cohorts</Heading>
    <p className="cohort-notice">Approved planting records and permanent samples. Existing schedules and official KPIs remain unchanged; sample and visit creation is never automatic.</p>
    {error && <p className="cohort-error" role="alert">{error}</p>}{message && <p className="cohort-success" role="status">{message}</p>}
    <label htmlFor="verified-cohort-selection">Verified cohort</label><select id="verified-cohort-selection" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select a cohort</option>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.id} — {cohort.verifiedPlantedQuantity} verified trees</option>)}</select>
    {cohortsLoading && <p role="status">Loading authorized verified cohorts...</p>}
    {!cohortsLoading && !cohorts.length && !error && <p role="status">No authorized verified cohorts are available.</p>}
    {selected && <section className="cohort-card"><h3>Verified planting record</h3><dl>
      <dt>Cohort</dt><dd>{selected.id}</dd><dt>Verified planted quantity</dt><dd>{selected.verifiedPlantedQuantity}</dd>
      <dt>Planting report</dt><dd>{selected.source?.plantingReportId ? <Link to={`/${userRole}/planting-reports?report=${encodeURIComponent(selected.source.plantingReportId)}`}>View source planting report</Link> : "Not recorded"}</dd><dt>Site</dt><dd>{selected.source?.siteId ? <Link to={`/${userRole}/planting-sites?site=${encodeURIComponent(selected.source.siteId)}`}>View registered planting site</Link> : "Not recorded"}</dd>
      <dt>Sampling plan</dt><dd>{selected.samplingPlan?.status || "Not started"}</dd><dt>Baseline</dt><dd>{selected.baseline?.approvalStatus || selected.baselineStatus || "Not started"}</dd>
    </dl>{sampleAnalyticsEnabled() && <p><Link to={`/${userRole}/permanent-sample-analytics`}>View approved sample coverage and survival estimates</Link></p>}{view === "records" && (userRole === "admin"
      ? <p>Open <Link to={`/${userRole}/survival-monitoring`}>Tree Survival Monitoring</Link> to review permanent sample plans and baseline records.</p>
      : <p>Sampling plans and baselines are managed in the Verified Planting Cohorts panel on <Link to={`/${userRole}/planting-reports`}>Planting Reports</Link>.</p>)}</section>}
    {selected && view !== "records" && <>
      <SamplingPolicyReadiness key={selected.id} cohort={selected} role={userRole} onSaved={reload} />
      <section className="cohort-card"><h2>Sampling Plan</h2><p>Provisional target: <strong>{samplingBlocked ? "Pending MENRO approval" : target}</strong> samples ({selected.samplingPlan?.provisionalPolicy || "test-only ceil(verified quantity × 10%)"}).</p>
      <label>Selection method<select value={selectionMethod} disabled={samplingBlocked || userRole !== "staff" || selected.samplingPlan?.status === "APPROVED"} onChange={(event) => setSelectionMethod(event.target.value)}><option value="documented-manual">Documented manual selection</option><option value="systematic">Systematic selection</option><option value="stratified">Stratified selection</option></select></label>
      {planSamples.map((sample, index) => <fieldset key={index}><legend>Sample {index + 1}</legend>{[["permanentId","Permanent ID"],["species","Species"],["siteReference","Site / plot reference"],["selectionReason","Selection note"]].map(([key,label]) => <label key={key}>{label}<input value={sample[key]} disabled={samplingBlocked || userRole !== "staff" || selected.samplingPlan?.status === "APPROVED"} onChange={(event) => setPlanSamples((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: event.target.value } : item))}/></label>)}<label>Unit type<select value={sample.unitType} disabled={samplingBlocked || userRole !== "staff" || selected.samplingPlan?.status === "APPROVED"} onChange={(event) => setPlanSamples((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, unitType: event.target.value } : item))}><option value="tree">Tree</option><option value="plot">Plot</option></select></label></fieldset>)}
      <label>Plan notes<textarea value={notes} disabled={samplingBlocked || userRole !== "staff" || selected.samplingPlan?.status === "APPROVED"} onChange={(event) => setNotes(event.target.value)} /></label>
      {userRole === "staff" && selected.samplingPlan?.status !== "APPROVED" && <p><button disabled={busy || samplingBlocked} onClick={() => savePlan(false)}>Save draft</button><button disabled={busy || samplingBlocked} onClick={() => savePlan(true)}>Submit plan for approval</button></p>}
      {userRole === "admin" && !selected.samplingPolicySnapshot && selected.samplingPlan?.status === "PENDING_ADMIN_APPROVAL" && <button disabled={busy || samplingBlocked} onClick={approvePlan}>Approve sampling plan</button>}
      <p>Status: {selected.samplingPlan?.status || "NOT STARTED"}</p></section>
      <section className="cohort-card"><h2>Staff Baseline</h2>{selected.samplingPlan?.status !== "APPROVED" ? <p>An Admin-approved sampling plan is required before baseline registration.</p> : <>{baselineUnits.map((unit, index) => <fieldset key={unit.permanentId}><legend>{unit.permanentId}</legend>{[["latitude","Latitude"],["longitude","Longitude"],["heightMeters","Height (m)"],["diameterCentimeters","Diameter (cm)"],["captureDate","Capture date"],["remarks","Remarks"]].map(([key,label]) => <label key={key}>{label}<input type={key === "captureDate" ? "date" : "text"} value={unit[key] ?? ""} disabled={userRole !== "staff" || selected.baseline?.approvalStatus === "APPROVED"} onChange={(event) => setBaselineUnits((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: event.target.value } : item))}/></label>)}<label>Condition<select value={unit.condition} disabled={userRole !== "staff" || selected.baseline?.approvalStatus === "APPROVED"} onChange={(event) => setBaselineUnits((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, condition: event.target.value } : item))}>{["Healthy","Damaged","Dead","Unknown"].map((condition) => <option key={condition}>{condition}</option>)}</select></label>{userRole === "staff" && selected.baseline?.approvalStatus !== "APPROVED" && <button type="button" onClick={() => { setCameraSampleId(unit.permanentId); setCameraOpen(true); }}>Capture verified baseline photo</button>}{baselinePhotos[unit.permanentId] && <><img className="cohort-photo-preview" src={baselinePhotos[unit.permanentId].previewUrl} alt={`Verified baseline for ${unit.permanentId}`} /><p>GPS accuracy: {Math.round(baselinePhotos[unit.permanentId].location.accuracy)} m · Site verified</p></>}{selected.baseline?.sampleUnits?.find((sample) => sample.permanentId === unit.permanentId)?.photoReferences?.map((photo, photoIndex) => <div key={photo.evidenceId}><p>Stored evidence: {photo.verificationStatus || "Needs Review"} · {photo.capturedAt ? "capture metadata retained" : "metadata unavailable"}</p>{storedPhotoUrls[`${selected.id}:${unit.permanentId}:${photoIndex}`] ? <img className="cohort-photo-preview" src={storedPhotoUrls[`${selected.id}:${unit.permanentId}:${photoIndex}`]} alt={`Stored baseline for ${unit.permanentId}`} /> : <button type="button" onClick={() => viewStoredPhoto(unit.permanentId, photo, photoIndex)}>View stored photo</button>}</div>)}</fieldset>)}
      {userRole === "staff" && selected.baseline?.approvalStatus !== "APPROVED" && <button disabled={busy} onClick={saveBaseline}>Submit baseline for approval</button>}
      {userRole === "admin" && selected.baseline?.approvalStatus === "PENDING_ADMIN_APPROVAL" && <button disabled={busy} onClick={approveBaseline}>Approve baseline</button>}
      <p>Status: {selected.baseline?.approvalStatus || selected.baselineStatus || "NOT STARTED"}</p></>}</section>
    </>}
    <SecureCameraCapture open={cameraOpen} request={cameraRequest} binding={cameraBinding} onVerified={attachBaselinePhoto} onCancel={() => { setCameraOpen(false); setCameraSampleId(""); }} onDiagnostic={({ message: diagnostic }) => setError(diagnostic)} />
  </Container>;
}
