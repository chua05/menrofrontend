import { useCallback, useState } from "react";
import MonitoringInformationPanel from "./MonitoringInformationPanel";
import { informationEnabled } from "../utils/permanentSampleFeatures";
import { Camera, Image, MapPin, Trees, ChevronLeft, ChevronRight, CircleCheck, AlertTriangle, Search, Circle, Lock } from "lucide-react";
import PlantingLocationMap from "./PlantingLocationMap";
import { MORTALITY_CAUSES, SAMPLE_CONDITIONS, growthPreview, hasCurrentEvidence, sampleProgress } from "../utils/sampleMonitoringForm";
import { scheduleStatusLabel } from "../utils/sampleVisitReadiness";
const shown = value => value === null || value === undefined || value === "" ? "Not available" : String(value);
const definitions = { Healthy: "Living tree in good condition.", Damaged: "Living tree with observed damage.", Dead: "Confirmed dead by field assessment.", "Needs Rechecking": "Condition is not yet confirmed." };
const PENDING_SCHEDULE = "Pending Official Schedule";
const PLAN_STATUS = { NOT_STARTED: "Not Started", FIRST_VISIT_AVAILABLE: "First Visit Available", DUE: "Due", DRAFT: "Draft", SCHEDULED: "Scheduled", AVAILABLE: "Available", OVERDUE: "Overdue", PENDING_ADMIN_APPROVAL: "Pending Admin Review", RETURNED: "Returned for Correction", APPROVED: "Approved", REJECTED: "Rejected" };
const CONFIRMED = new Set(["Healthy", "Damaged", "Dead"]);
// Read-only views (Admin review, submitted or approved visits) show only the server state; nothing there is "Unsaved".
const SUBMITTED = new Set(["PENDING_ADMIN_APPROVAL", "APPROVED"]);
const deltaText = (value, unit = "") => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))
  ? `${Number(value) > 0 ? "+" : ""}${Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`
  : "Pending — requires comparable approved measurements";
const assessmentStage = condition => condition === "Needs Rechecking" ? "Rechecking required"
  : CONFIRMED.has(condition) ? "Recorded — pending visit submission and Admin review" : "Pending assessment";
const scheduleLabel = (detail, context) => {
  if (detail?.registersBaseline && detail?.status === "DRAFT") return "First Visit Available";
  if (detail?.status && PLAN_STATUS[detail.status]) return PLAN_STATUS[detail.status];
  return context?.schedule?.status || PENDING_SCHEDULE;
};
const treeIcon = row => row.condition === "Dead" ? <AlertTriangle size={16} aria-hidden="true" className="psm-tree-dead" />
  : row.condition === "Needs Rechecking" ? <Search size={16} aria-hidden="true" className="psm-tree-recheck" />
    : CONFIRMED.has(row.condition) ? <CircleCheck size={16} aria-hidden="true" className="psm-tree-done" />
      : <Circle size={16} aria-hidden="true" className="psm-tree-empty" />;
function Reference({ label, value }) { return <div><dt>{label}</dt><dd>{shown(value)}</dd></div>; }
// Species and planted quantities come only from the authoritative cohort; unknown counts stay unknown.
function SpeciesQuantities({ rows, fallback }) {
  if (!rows?.length) return <Reference label="Species and Quantities" value={fallback} />;
  return <div><dt>Species and Quantities</dt><dd><ul className="psm-species">{rows.map((row, index) => <li key={`${index}-${row.species}`}>
    {row.verifiedPlantedQuantity == null ? `${row.species}: quantity not recorded` : `${row.species}: ${row.verifiedPlantedQuantity} planted`}</li>)}</ul></dd></div>;
}
// Read-only layout of the seven monitoring sections shown before an authorized visit is selected.
// Every value is an honest empty state; no site, schedule, Tree ID or approval is implied and every control is disabled.
// `report` (optional): a setup-pending verified planting report (read-only tracking row), or an eligible
// readiness row whose backend `context` fills section 1 and the map before visit 1 exists. Sampling values
// appear only when a permanent-sample cohort actually exists.
const SHELL_FIELDS = ["Planting Report ID", "Planting Site Name", "Barangay / Address", "Planting Date", "Verification Status", "Verified Planted Quantity",
  "Species and Quantities", "Automatic 10% Sample Target", "Sample Registration Status", "Registered Sample Tree Count", "Monitoring Visit Number", "Current Monitoring Status"];
export function PermanentSampleVisitShell({ describedBy, report = null, firstVisit = false }) {
  const none = "No authorized visit selected";
  const disabledProps = { disabled: true, "aria-describedby": describedBy };
  const context = report?.context || null;
  const cohort = report?.cohort || null;
  // Without the backend's own answer for this report nothing is claimed about its registration or status.
  const noCohort = report ? "Not available yet" : none;
  const statusText = value => PLAN_STATUS[value] || value;
  const values = context ? {
    "Planting Report ID": context.plantingReportNumber || report.reportNumber || context.plantingReportId,
    "Planting Site Name": context.site?.siteName || report.siteName,
    "Barangay / Address": [context.site?.barangay, context.site?.address].filter(Boolean).join(" · "),
    "Planting Date": context.plantingDate,
    "Verification Status": context.verificationStatus,
    "Verified Planted Quantity": context.verifiedPlantedQuantity,
    "Automatic 10% Sample Target": context.sampleTarget,
    "Sample Registration Status": statusText(context.sampleRegistrationStatus),
    "Registered Sample Tree Count": context.registeredSampleCount,
    "Monitoring Visit Number": context.nextVisitNumber ?? report.nextVisitNumber,
    "Current Monitoring Status": statusText(context.monitoringStatus),
  } : report ? {
    "Planting Report ID": report.reportNumber || "Not available",
    "Planting Site Name": report.siteName || "Not available",
    "Barangay / Address": report.barangay || "Not available",
    "Verification Status": report.verificationStatus || "Verified",
    "Planting Date": report.plantingDate || "Not available",
    "Verified Planted Quantity": report.verifiedPlantedQuantity ?? "Not available",
    "Automatic 10% Sample Target": cohort ? cohort.approvedSampleTarget ?? "Not approved" : noCohort,
    "Sample Registration Status": cohort ? cohort.samplingPlanStatus : noCohort,
    "Registered Sample Tree Count": cohort ? cohort.registeredSampleTrees ?? "None registered" : noCohort,
    "Species and Quantities": report.species || "Shown after an authorized visit is created",
    "Monitoring Visit Number": "Not assigned",
    "Current Monitoring Status": "Not available yet",
  } : { "Monitoring Visit Number": "Not assigned" };
  const species = context?.species?.map(row => ({ species: row.species, verifiedPlantedQuantity: row.quantity ?? null }));
  // M4: Section 2 reads the same readiness row as Section 1, so both show the same visit number.
  // Visit 1 has no fixed due date (spec §7); later visits show the backend-computed opening date.
  const visitNumber = context ? context.nextVisitNumber ?? report.nextVisitNumber ?? null : null;
  // Visit 1 registers the baseline unless the report already has an approved plan from the earlier workflow.
  const baselineVisit = report ? Boolean(report.registersBaseline) || !context && !cohort : firstVisit;
  const firstOfSchedule = context && (report.registersBaseline === true || visitNumber === 1);
  const schedule = context ? {
    start: firstOfSchedule ? "—" : PENDING_SCHEDULE,
    next: firstOfSchedule ? "Not fixed for Visit 1"
      : report.nextScheduledDueDate || report.openingDate || PENDING_SCHEDULE,
    visit: visitNumber ?? "Not assigned",
    status: context.monitoringStatus === "FIRST_VISIT_AVAILABLE" ? statusText("FIRST_VISIT_AVAILABLE")
      : report.scheduleStatus ? scheduleStatusLabel(report.scheduleStatus) : PENDING_SCHEDULE,
  } : { start: PENDING_SCHEDULE, next: PENDING_SCHEDULE, visit: "Not assigned", status: PENDING_SCHEDULE };
  return <fieldset className="psm-shell" disabled aria-describedby={describedBy}>
    <legend className="psm-shell-legend">Monitoring form (read-only until an authorized visit is selected)</legend>
    <section className="psm-section"><h3>1. Verified Planting Site Information</h3>
      <dl className="psm-info">{SHELL_FIELDS.map(label => label === "Species and Quantities" && species?.length
        ? <SpeciesQuantities key={label} rows={species} />
        : <Reference key={label} label={label} value={label in values ? values[label] : none} />)}</dl>
    </section>
    <section className="psm-section"><h3>2. Monitoring Summary &amp; Automatic Schedule</h3><dl className="psm-info">
      <Reference label="Start Monitoring Date" value={schedule.start} /><Reference label="Next Monitoring Date" value={schedule.next} />
      <Reference label="Monitoring Visit" value={schedule.visit} /><Reference label="Schedule Status" value={schedule.status} /></dl>
      <div className="psm-field"><label htmlFor="sample-shell-date-monitored">Date Monitored *</label><input id="sample-shell-date-monitored" type="date" value="" readOnly {...disabledProps} /></div>
      <p className="psm-note">Scheduled dates come only from an authorized visit created under an approved MENRO schedule.</p>
    </section>
    <section className="psm-section"><h3>3. Assessment Progress</h3><div className="psm-progress">
      {[["Assessed", "Healthy, Damaged or Dead"], ["Needs Rechecking", "Unresolved"], ["Not Assessed", "No condition recorded"]].map(([label, hint]) =>
        <div className="psm-progress-card" key={label}><span>{label}</span><strong>0</strong><small>{hint}</small></div>)}</div>
      <p role="status">No registered sample trees are loaded.</p>
    </section>
    <section className="psm-section"><h3>4. Permanent Sample Tree Records</h3>
      <p>{baselineVisit
        ? "No registered Tree IDs are available yet. Visit 1 registers the baseline: Tree IDs for the automatic 10% sample are generated when Staff start Visit 1 and remain provisional until Admin approval."
        : "No registered Tree IDs are available for this report yet."}</p></section>
    <section className="psm-section"><h3>5. Individual Tree Assessment</h3>
      <p>Select a registered Tree ID from an authorized visit to record its assessment.</p>
      <h4 className="psm-heading"><Camera size={18} /> Monitoring Photo</h4><div className="psm-photo-box"><Camera size={28} /><strong>Monitoring Photo Evidence</strong>
        <div className="psm-actions"><button type="button" className="psm-primary" {...disabledProps}><Camera size={17} /> Take Photo</button>
          <button type="button" {...disabledProps}><Image size={17} /> Upload Existing Photo</button></div></div>
      <h4 className="psm-heading"><MapPin size={18} /> Photo Location Verification</h4><div className="psm-location"><div className="psm-location-title"><strong>Location Verification</strong>
        <button type="button" {...disabledProps}>Verify Photo Location</button></div>
        <p>The authoritative planting site appears when it is available; tree and evidence markers appear only after an authorized visit.</p>
        {report&&<PlantingLocationMap site={context?.site||report.site||null} status={{type:"info",label:"Awaiting Photo"}} highlightSitePolygon />}</div>
      <h4>Tree Measurements</h4><div className="psm-measurements">
        <div className="psm-field"><label htmlFor="sample-shell-height">Height (cm)</label><input id="sample-shell-height" type="number" value="" readOnly {...disabledProps} /></div>
        <div className="psm-field"><label htmlFor="sample-shell-diameter">Stem Diameter (mm)</label><input id="sample-shell-diameter" type="number" value="" readOnly {...disabledProps} /></div></div>
      <div className="psm-field"><span className="psm-label" id="sample-shell-condition-label">Tree Condition *</span>
        <div className="psm-conditions" role="radiogroup" aria-labelledby="sample-shell-condition-label">{SAMPLE_CONDITIONS.map(value => <div className="psm-condition" key={value}>
          <label><input type="radio" name="sample-shell-condition" value={value} checked={false} readOnly {...disabledProps} />{value}</label><small>{definitions[value]}</small></div>)}</div></div>
      <div className="psm-field"><label htmlFor="sample-shell-remarks">Individual Remarks</label><textarea id="sample-shell-remarks" value="" rows={3} readOnly {...disabledProps} /></div>
      <h4>Assessment History</h4><p>No previous assessment or baseline reference is loaded.</p>
    </section>
    <section className="psm-section"><h3>6. Rechecking &amp; Requester Clarification</h3>
      <p>Not applicable until a registered tree is assessed as Needs Rechecking in an authorized visit.</p>
      <label><input type="checkbox" checked={false} readOnly {...disabledProps} /> Request additional information from Requester</label></section>
    <section className="psm-section psm-summary"><h3 className="psm-heading"><Trees size={18} /> 7. Automatic Monitoring Visit Summary</h3><dl className="psm-info">
      {[["Healthy", 0], ["Damaged (Living)", 0], ["Confirmed Dead", 0], ["Needs Rechecking", 0], ["Not Assessed", 0], ["Total Registered Sample Trees", 0], ["Assessment Completion Count", "0 / 0"]].map(([label, value]) => <Reference key={label} label={label} value={value} />)}</dl>
      <p>Official Sample Survival Status: No authorized visit selected.</p>
      <div className="psm-field"><label htmlFor="sample-shell-visit-remarks">Overall Visit Remarks (Optional)</label><textarea id="sample-shell-visit-remarks" value="" rows={3} readOnly {...disabledProps} /></div></section>
    <section className="psm-section"><h3>8. Actions &amp; Monitoring Visit History</h3><p>No authorized monitoring visit history is loaded.</p></section>
  </fieldset>;
}
export default function PermanentSampleVisitForm({ detail, assessments, activeTreeId, onTree, errors, onChange, onSave,
  saving, onCapture, onUpload, originalEnabled = false, onOriginal, pendingFor, onDiscard, onView, evidenceUrls, evidenceKey, visitRemarks, onVisitRemarks, dateMonitored, onDateMonitored, questions, onQuestion, readOnly = false, inlineEvidenceHistory = true, onOpenVisit }) {
  const [clarifications, setClarifications] = useState({});
  // A marker opens its tree; its details stay shown on the map of that tree.
  const [popupTreeId, setPopupTreeId] = useState("");
  const selectOnMap = useCallback((sampleId, fromPopup) => {
    setPopupTreeId(fromPopup ? "" : sampleId); onTree(sampleId);
    if (fromPopup) window.setTimeout(() => document.getElementById("sample-active-assessment")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }, [onTree]);
  const chooseTree = sampleId => { setPopupTreeId(""); onTree(sampleId); };
  const context=detail.visitContext, savedRows=(detail.sampleAssessments||[]).map(row=>({ ...row, condition: row.condition || "" })), progress=sampleProgress(savedRows), confirmed=progress.healthy+progress.damaged+progress.dead;
  const active=assessments.find(row=>row.sampleId===activeTreeId);
  const index=assessments.findIndex(row=>row.sampleId===active?.sampleId);
  const sample=context?.samples?.find(row=>row.sampleId===active?.sampleId);
  const server=detail.sampleAssessments?.find(row=>row.sampleId===active?.sampleId), pending=active && pendingFor(active.sampleId);
  const previous=sample?.previous || sample?.baseline;
  const locked=Boolean(active?.inheritedConfirmedDead);
  const photoMissing=row=>Boolean(detail.schedulePolicyVersion||detail.registersBaseline)&&Boolean(row?.condition)&&!hasCurrentEvidence(row);
  const savedOf=sampleId=>detail.sampleAssessments?.find(row=>row.sampleId===sampleId);
  const awaitingPhoto=(detail.sampleAssessments||[]).filter(photoMissing).length;
  const dirty = row => {
    const saved = detail.sampleAssessments?.find(item => item.sampleId === row.sampleId) || {};
    return ["condition","remarks","mortalityCause","recheckReason","investigationOutcome","searchFindings","heightCentimeters","stemDiameterMillimeters"]
      .some(field => String(row[field] ?? "") !== String(saved[field] ?? ""));
  };
  const activeDirty=Boolean(active)&&!readOnly&&dirty(active);
  const stored={ height:server?.heightDifferenceCm ?? active?.heightDifferenceCm ?? active?.growthDelta?.heightCentimeters ?? null,
    diameter:server?.stemDiameterDifferenceMm ?? active?.stemDiameterDifferenceMm ?? (active?.growthDelta?.diameterCentimeters==null?null:Number(active.growthDelta.diameterCentimeters)*10),
    decreased:Boolean(server?.measurementDecreased||active?.measurementDecreased) };
  const growth=activeDirty&&!detail.registersBaseline?growthPreview(active,server?.previousMeasurement||previous):stored;
  const input = (field, caption, kind="input") => {
    const id=`sample-${active.sampleId}-${field}`, message=errors[`${active.sampleId}.${field}`];
    const props={id, value:active[field], disabled:saving||readOnly||locked, "aria-invalid":Boolean(message), "aria-describedby":message?`${id}-error`:undefined,
      onChange:event=>onChange(active.sampleId,field,event.target.value)};
    return <div className="psm-field" data-validation-field={`${active.sampleId}.${field}`}><label htmlFor={id}>{caption}</label>
      {kind==="textarea"?<textarea {...props} maxLength={1000} rows={3}/>:<input {...props} type="number" min="0" step="any"/>}
      {message&&<small role="alert" id={`${id}-error`}>{message}</small>}</div>;
  };
  return <>
    {!readOnly&&detail.reviewReasons&&["DRAFT","RETURNED"].includes(detail.status)&&<section className="psm-warning" role="status" aria-label="Returned for Correction">
      <strong>Returned for Correction</strong><p>{detail.reviewReasons}</p><p>Correct the trees named above and save them. A changed assessment needs a new verified photo before you submit the visit again.</p></section>}
    <section className="psm-section"><h3>1. Verified Planting Site Information</h3>
      {detail.registersBaseline&&<p className="psm-baseline-banner">Visit 1 — Baseline registration. Tree IDs and the 10% sample remain provisional until Admin approval.</p>}
      <dl className="psm-info"><Reference label="Planting Report ID" value={context?.reportNumber||context?.plantingReportId}/><Reference label="Planting Site Name" value={context?.siteName}/>
        <Reference label="Barangay / Address" value={context?.barangay}/><Reference label="Verification Status" value={context?.reportStatus==="Completed"?"Verified":context?.reportStatus}/>
        <Reference label="Planting Date" value={context?.plantingDate}/><Reference label="Verified Planted Quantity" value={context?.verifiedPlantedQuantity}/>
        <Reference label="Automatic 10% Sample Target" value={context?.sampleTarget??context?.approvedSampleTarget}/><Reference label="Sample Registration Status" value={PLAN_STATUS[context?.planStatus] || context?.planStatus}/>
        <Reference label="Registered Sample Tree Count" value={context?.registeredSampleTrees??assessments.length}/>
        <SpeciesQuantities rows={context?.speciesQuantities} fallback={context?.samples?.map(row=>row.species).filter(Boolean).filter((value,index,all)=>all.indexOf(value)===index).join(", ")}/>
        <Reference label="Monitoring Visit Number" value={detail.visitNumber||context?.schedule?.visitNumber||"Not assigned"}/>
        <Reference label="Current Monitoring Status" value={scheduleLabel(detail, context)}/></dl>
    </section>
    <section className="psm-section"><h3>2. Monitoring Summary &amp; Automatic Schedule</h3><dl className="psm-info">
      <Reference label="Start Monitoring Date" value={detail.registersBaseline?["APPROVED","PENDING_ADMIN_APPROVAL"].includes(detail.status)&&detail.dateMonitored?`${detail.dateMonitored}${detail.status==="APPROVED"?"":" (Pending Admin Review)"}`:"—":context?.schedule?.startMonitoringDate||PENDING_SCHEDULE}/>
      <Reference label="Scheduled Due Date" value={detail.registersBaseline?"Not fixed for Visit 1":detail.scheduledDueDate||context?.schedule?.nextMonitoringDate||PENDING_SCHEDULE}/>
      <Reference label="Monitoring Visit Number" value={detail.visitNumber||context?.schedule?.visitNumber||"Not assigned"}/><Reference label="Schedule Status" value={scheduleLabel(detail, context)}/></dl>
      <div className="psm-field"><label htmlFor="sample-date-monitored">Date Monitored *</label><input id="sample-date-monitored" type="date" required min={detail.openingDate||undefined} max={new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())} value={dateMonitored} disabled={saving||readOnly} aria-invalid={Boolean(errors.dateMonitored)} aria-describedby={errors.dateMonitored?"sample-date-monitored-error":undefined} onChange={event=>onDateMonitored(event.target.value)}/>{errors.dateMonitored&&<small role="alert" id="sample-date-monitored-error">{errors.dateMonitored}</small>}</div>
      <p className="psm-note"><strong>Automatic Schedule:</strong> {detail.registersBaseline?"Visit 2 will be due one calendar month after the approved Visit 1 assessment date.":"The next visit is due three calendar months after this visit's scheduled due date, even when this visit is recorded late."}</p>
      <p className="psm-note">Date Monitored is the actual day of the field assessment. It cannot be in the future{detail.openingDate?` or before ${detail.openingDate}`:""}.</p>
    </section>
    {/* Non-overlapping counts: confirmed condition + unresolved rechecking + not assessed = registered trees. */}
    <section className="psm-section"><h3>3. Assessment Progress</h3><div className="psm-progress">
      {[["Saved / Assessed", confirmed, "Server-confirmed Healthy, Damaged or Dead"], ["Needs Rechecking", progress.rechecking, "Server-confirmed unresolved"], ["Not Assessed", progress.notAssessed, "No saved condition"], ["Total Sample Trees", progress.total, "Registered permanent sample"]].map(([label, value, hint]) =>
        <div className="psm-progress-card" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>)}</div>
      <div className="psm-progress-bar"><progress aria-label="Confirmed sample assessments" value={confirmed} max={progress.total||1}/><span>{`${confirmed} / ${progress.total} confirmed`}</span></div>
      <p role="status">{`${progress.assessed}/${progress.total} assessments recorded; ${progress.rechecking === 1 ? "1 needs" : `${progress.rechecking} need`} rechecking.`}</p>
      {awaitingPhoto>0&&<p className="psm-warning" role="status">{`${awaitingPhoto} saved assessment${awaitingPhoto===1?" still needs a verified photo":"s still need a verified photo"} before this visit can be submitted.`}</p>}
    </section>
    <section className="psm-section"><h3>4. Permanent Sample Tree Records</h3>
      <p className="psm-note">{detail.registersBaseline?"Staff choose the actual trees on site. The system provides one provisional Tree ID for each tree of the exact sample.":"The same approved permanent trees are assessed on every visit."}</p>
      <label className="psm-field">Tree ID selector<select value={activeTreeId} onChange={event=>chooseTree(event.target.value)}><option value="">Select a Tree ID</option>{assessments.map(row=><option key={row.sampleId} value={row.sampleId}>{row.sampleId}</option>)}</select></label>
      <div className="psm-tree-list">{assessments.map(row=>{
      const reference=context?.samples?.find(item=>item.sampleId===row.sampleId);
      const prior=row.previousAssessmentReference?.condition||reference?.previous?.condition||reference?.baseline?.condition;
      return <button type="button" key={row.sampleId} aria-expanded={row.sampleId===active?.sampleId} aria-controls="sample-active-assessment" onClick={()=>chooseTree(row.sampleId===active?.sampleId?"":row.sampleId)}>
        <span><strong>{row.sampleId}</strong>{reference?.species&&` · ${reference.species}`}</span>
        <span className="psm-tree-state">{treeIcon(row)}{row.inheritedConfirmedDead?"Dead — Carried Forward":row.condition||"Not Assessed"}{readOnly?(SUBMITTED.has(detail.status)?" · Submitted":" · Saved"):dirty(row)?" · Unsaved":" · Saved"}{photoMissing(savedOf(row.sampleId))?" · Photo required":""}{prior?` · Previous: ${prior}`:""}{row.recheckRequired||row.previousAssessmentReference?" · Rechecking carried forward":""}</span></button>;
    })}</div>
      <div className="psm-tree-nav"><button type="button" disabled={index<=0} onClick={()=>chooseTree(assessments[index-1].sampleId)}><ChevronLeft size={17}/> Previous Tree</button><button type="button" disabled={index<0||index>=assessments.length-1} onClick={()=>chooseTree(assessments[index+1].sampleId)}>Next Tree <ChevronRight size={17}/></button></div>
    </section>
    {!active&&<section id="sample-active-assessment" hidden /> }
    {active&&<section className="psm-section" id="sample-active-assessment"><h3>5. Individual Tree Assessment</h3><fieldset className="psm-tree" key={active.sampleId}><legend>{active.sampleId}</legend>
      <h4>Previous Assessment Reference</h4>{previous?<dl className="psm-info"><Reference label="Previous Visit Number" value={context?.treeTimeline?.[active.sampleId]?.at(-1)?.visitNumber}/><Reference label="Previous Assessment Date" value={previous.assessedOn||previous.date}/><Reference label="Previous Condition" value={previous.condition}/>
        <Reference label="Previous Height (cm)" value={previous.heightCentimeters}/><Reference label="Previous Stem Diameter (mm)" value={previous.stemDiameterMillimeters ?? (previous.diameterCentimeters == null ? null : Number(previous.diameterCentimeters)*10)}/>
        <Reference label="Previous Remarks" value={previous.remarks}/><Reference label="Registered GPS" value={sample?.latitude!=null&&sample?.longitude!=null?`${sample.latitude}, ${sample.longitude}`:null}/></dl>
        :<p>{detail.registersBaseline?"Baseline Registration — this first visit establishes the initial permanent-sample measurements and evidence.":"No previous approved assessment is available."}</p>}
      {(context?.treeTimeline?.[active.sampleId]||[]).some(entry=>entry.condition==="Needs Rechecking")&&<div className="psm-history"><h4>Previous Rechecking History</h4><ul>{context.treeTimeline[active.sampleId].filter(entry=>entry.condition==="Needs Rechecking").map(entry=><li key={`${entry.visitId}-${entry.assessedOn}`}>Visit {entry.visitNumber}: {entry.recheckReason||entry.remarks||"Rechecking recorded"}</li>)}</ul></div>}
      {active.previousAssessmentReference&&<p>Previous assessment: {active.previousAssessmentReference.condition} {active.previousAssessmentReference.remarks}</p>}
      {(sample?.previous?.evidence || Array.from({length:sample?.baseline?.photoCount||0},(_,index)=>({index}))).map(photo=>{
        const source=sample.previous?.visitId||"baseline", key=evidenceKey(active.sampleId,photo.index,source);
        return evidenceUrls[key]?<img key={key} style={{maxWidth:"100%",maxHeight:220}} src={evidenceUrls[key]} alt={`Previous verified photo for ${active.sampleId}`}/>:<button key={key} type="button" onClick={()=>onView(active.sampleId,photo.index,source)}>View previous verified photo {photo.index+1}</button>;
      })}
      <h4 className="psm-heading"><Camera size={18}/> Monitoring Photo</h4><div className="psm-photo-box"><Camera size={28}/><strong>Monitoring Photo Evidence</strong>
        <p>Private verified evidence for {active.sampleId}.</p><div className="psm-actions">
          {!readOnly&&<button type="button" className="psm-primary" disabled={saving} onClick={()=>onCapture(active.sampleId)} aria-label={`Capture verified photo for ${active.sampleId}`}><Camera size={17}/> Take Photo</button>}
          {!readOnly&&<button type="button" disabled={!originalEnabled||saving} onClick={()=>document.getElementById(`sample-${active.sampleId}-original-file`)?.click()} aria-describedby={`sample-${active.sampleId}-original-policy`} title={originalEnabled?undefined:"Original-photo verification rules are awaiting MENRO approval."}><Image size={17}/> Upload Existing Photo</button>}
          {originalEnabled && <input id={`sample-${active.sampleId}-original-file`} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden disabled={!originalEnabled||saving||readOnly} onChange={event=>{onOriginal?.(active.sampleId,event.target.files?.[0]);event.target.value="";}}/>}</div>
        <p className="psm-note">Maximum file size: 10 MB. An existing photo must be the original JPEG with its embedded GPS and capture time.</p>
        <p className="psm-note" id={`sample-${active.sampleId}-original-policy`}>{originalEnabled ? "The server checks the original photo's embedded GPS, capture date and planting site. GPS accuracy is Unknown, so Admin must review it. EXIF does not prove authenticity." : "Existing-photo uploads are awaiting MENRO approval of original-photo verification rules. Use Take Photo."}</p></div>
      {pending&&<div className="psm-preview"><img src={pending.previewUrl} alt={`${pending.descriptor.source === "uploaded-original" ? "Original photo" : "Verified evidence"} preview for ${active.sampleId}`}/><p role="status">{pending.descriptor.source === "uploaded-original" ? "Original photo selected. Verify its location to upload it." : "Verified photo ready for private upload."}</p>
        <button type="button" disabled={saving} onClick={()=>onDiscard(active.sampleId)}>Remove pending photo</button></div>}
      <h4 className="psm-heading"><MapPin size={18}/> Photo Location Verification</h4><div className="psm-location"><div className="psm-location-title"><strong>Location Verification</strong>
        {!readOnly&&<button type="button" disabled={!pending||saving} onClick={()=>onUpload(active.sampleId)} aria-label={`${pending?.descriptor.source === "uploaded-original" ? "Verify and upload original photo" : "Upload verified photo"} for ${active.sampleId}`}>{saving?"Verifying...":"Verify Photo Location"}</button>}</div>
        <p>{pending?.descriptor.source === "uploaded-original" ? "Original EXIF location must be validated by the server. GPS accuracy: Unknown; Admin review required." : pending?"Location comes from the backend-verified camera capture, not fabricated EXIF.":"Secure camera photos use their separately verified capture location."}</p>
        <PlantingLocationMap key={`${detail.id}-${active.sampleId}`} site={context?.site||null} treeMarkers={context?.treeMarkers||undefined} selectedTreeId={active.sampleId} registeredTree={sample} onSelectTree={selectOnMap} popupTreeId={popupTreeId} highlightSitePolygon evidence={pending?.location||server?.evidenceHistory?.at(-1)?.location||null} status={errors[active.sampleId + ".evidence"]
          ? {type:"error",label:server?.evidenceHistory?.length?"Replacement Required":"Failed"}
          : saving&&pending?{type:"info",label:"Verifying"}:pending?{type:"warning",label:"Pending Upload"}
            : server?.evidenceHistory?.at(-1)?.location?{type:"success",label:"Verified"}:{type:"info",label:"Awaiting Photo"}}/>
        {pending?.location&&<p>Evidence GPS: {pending.location.latitude}, {pending.location.longitude}. Accuracy: {pending.location.accuracyMeters!=null||pending.location.accuracy!=null?`${pending.location.accuracyMeters??pending.location.accuracy} m`:"Unknown; Admin review required"}</p>}
        {errors[active.sampleId + ".evidence"]&&<p role="alert">{errors[active.sampleId + ".evidence"]}</p>}
        <p className="psm-note">Geotagging verifies evidence location. Staff determines the tree's biological condition.</p></div>
      {/* Review mode lists every tree's private evidence once, in the consolidated Admin review list. */}
      {inlineEvidenceHistory && <div className="psm-history">{(server?.evidenceHistory||[]).map((evidence,n)=>{const key=evidenceKey(active.sampleId,n);return <div key={key}><p>Historical evidence revision {evidence.revision}{evidence.source === "uploaded-original" ? " - Uploaded original - GPS accuracy Unknown - Requires Admin review" : ""}</p>{evidenceUrls[key]?<img src={evidenceUrls[key]} alt={`Private evidence for ${active.sampleId}, revision ${evidence.revision}`}/>:<button type="button" onClick={()=>onView(active.sampleId,n)}>View private evidence revision {evidence.revision}</button>}</div>;})}</div>}
      <h4>Tree Measurements</h4>{["Dead","Needs Rechecking"].includes(active.condition)
        ? <p className="psm-note">Measurements are not recorded for {active.condition}.</p>
        : <div className="psm-measurements">{input("heightCentimeters","Height (cm)")}{input("stemDiameterMillimeters","Stem Diameter (mm)")}</div>}
      <div className="psm-field" data-validation-field={`${active.sampleId}.condition`}><span className="psm-label" id={`sample-${active.sampleId}-condition-label`}>Tree Condition *</span>
        <div className="psm-conditions" role="radiogroup" aria-labelledby={`sample-${active.sampleId}-condition-label`} aria-invalid={Boolean(errors[`${active.sampleId}.condition`])} aria-describedby={errors[`${active.sampleId}.condition`]?`sample-${active.sampleId}-condition-error`:undefined}>
          {SAMPLE_CONDITIONS.map(value=>{const id=`sample-${active.sampleId}-condition-${value.replace(/\s+/g,"-").toLowerCase()}`;return <div className="psm-condition" key={value}>
            <label><input type="radio" name={`sample-${active.sampleId}-condition`} value={value} checked={active.condition===value} disabled={saving||readOnly||locked} aria-describedby={`${id}-help`} onChange={()=>onChange(active.sampleId,"condition",value)}/>{value}</label>
            <small id={`${id}-help`}>{definitions[value]}</small></div>;})}</div>
        {errors[`${active.sampleId}.condition`]&&<small role="alert" id={`sample-${active.sampleId}-condition-error`}>{errors[`${active.sampleId}.condition`]}</small>}</div>
      {questions[active.sampleId]?.trim()&&active.condition!=="Needs Rechecking"&&<div className="psm-note"><p>Unsent requester question: {questions[active.sampleId]}</p><button type="button" data-discard-question="" disabled={saving||readOnly} aria-label={`Discard unsent question for ${active.sampleId}`} onClick={()=>onQuestion(active.sampleId,"")}>Discard unsent question</button></div>}
      {locked?<div className="psm-locked" role="status"><Lock size={17}/> Dead — Carried Forward. This approved mortality record is read-only and retains its original evidence reference.</div>:<>
        {active.condition==="Dead"&&<div className="psm-field" data-validation-field={`${active.sampleId}.mortalityCause`}><label htmlFor={`sample-${active.sampleId}-mortalityCause`}>Cause of Mortality *</label><select id={`sample-${active.sampleId}-mortalityCause`} value={active.mortalityCause} disabled={saving||readOnly} aria-invalid={Boolean(errors[`${active.sampleId}.mortalityCause`])} onChange={event=>onChange(active.sampleId,"mortalityCause",event.target.value)}><option value="">Select cause</option>{MORTALITY_CAUSES.map(cause=><option key={cause}>{cause}</option>)}</select>{errors[`${active.sampleId}.mortalityCause`]&&<small role="alert">{errors[`${active.sampleId}.mortalityCause`]}</small>}</div>}
        {input("remarks",["Dead","Needs Rechecking"].includes(active.condition)?"Individual Remarks *":"Individual Remarks","textarea")}
      </>}
      <h4>Automatic Growth Evaluation</h4>
      {activeDirty&&!detail.registersBaseline&&<p className="psm-note">Based on the values entered now. The server confirms it when the assessment is saved.</p>}
      <dl className="psm-info psm-growth" aria-label="Automatic Growth Evaluation">
        <Reference label="Height Difference" value={deltaText(growth.height,"cm")} />
        <Reference label="Stem Diameter Difference" value={deltaText(growth.diameter,"mm")} />
        <Reference label="Growth Performance" value={server?.growthPerformance||active.growthPerformance||"Pending Approved Criteria"} />
        <Reference label="Growth Stage" value={server?.growthStage||active.growthStage||"Pending Stage Criteria"} />
        <Reference label="Assessment Stage" value={assessmentStage(active.condition)} />
      </dl>
      {growth.decreased&&<p className="psm-warning" role="status">A measurement decreased from the latest approved comparison. Re-measure or explain the difference; this warning does not change the recorded condition.</p>}
      {(detail.registersBaseline||server?.baselineOnly||active.baselineOnly)&&<p className="psm-note">Initial baseline recorded. Growth comparison will be available on succeeding monitoring visits.</p>}
      <p className="psm-tree-status"><strong>Assessment Status</strong><span className={activeDirty?"is-unsaved":""}>{readOnly?SUBMITTED.has(detail.status)?"Submitted":"Saved":activeDirty?"Unsaved Changes":!server?.condition?"Not Saved":photoMissing(server)?"Saved — Photo Required":"Saved"}</span></p>
      {!readOnly&&<button type="button" className="psm-primary" aria-label="Save Tree Assessment" disabled={saving||locked} onClick={()=>onSave(false,active.sampleId)}>Save Tree Assessment</button>}
    </fieldset></section>}
    {active?.condition==="Needs Rechecking"&&<section className="psm-section psm-rechecking"><h3>6. Rechecking &amp; Requester Clarification</h3>
      <dl className="psm-info"><Reference label="Rechecking Required" value="Yes — Needs Rechecking"/><Reference label="Next Scheduled Monitoring Visit" value={context?.schedule?.nextMonitoringDate||PENDING_SCHEDULE}/></dl>
      {input("recheckReason","Reason for Rechecking *","textarea")}{input("searchFindings","Location / Search Findings","textarea")}
      <p className="psm-note">This tree is carried into the next approved monitoring visit. It is never counted as dead while unresolved.</p>
      <label className="psm-field">Investigation outcome<select value={active.investigationOutcome} disabled={saving||readOnly} onChange={event=>onChange(active.sampleId,"investigationOutcome",event.target.value)}><option value="">No outcome recorded</option><option>Not Located After Rechecking</option></select></label>
      {questions[active.sampleId]?.trim()&&!clarifications[active.sampleId]&&<div className="psm-note"><p>Unsent requester question: {questions[active.sampleId]}</p><button type="button" data-discard-question="" disabled={saving||readOnly} aria-label={`Discard unsent question for ${active.sampleId}`} onClick={()=>onQuestion(active.sampleId,"")}>Discard unsent question</button></div>}
      <label><input type="checkbox" checked={Boolean(clarifications[active.sampleId])} disabled={!informationEnabled() || server?.condition !== "Needs Rechecking" || saving || readOnly} onChange={event=>setClarifications(current=>({...current,[active.sampleId]:event.target.checked}))}/> Request additional information from Requester</label>
      {!informationEnabled() ? <p className="psm-note">Requester information is not enabled for this environment.</p> : server?.condition !== "Needs Rechecking" ? <p className="psm-note">Save the rechecking assessment before requesting information.</p> : clarifications[active.sampleId] && <MonitoringInformationPanel key={active.sampleId} visitId={detail.id} sampleId={active.sampleId} assessmentRevision={server.assessmentRevision||0} readOnly={readOnly} draftQuestion={questions[active.sampleId]||""} onDraftQuestion={value=>onQuestion(active.sampleId,value)}/>}</section>}
    <section className="psm-section psm-summary"><h3 className="psm-heading"><Trees size={18}/> 7. Automatic Monitoring Visit Summary</h3><dl className="psm-info">{[["Healthy",detail.summary?.healthy??progress.healthy],["Damaged (Living)",detail.summary?.damaged??progress.damaged],["Confirmed Dead",detail.summary?.confirmedDead??detail.summary?.dead??progress.dead],["Needs Rechecking",detail.summary?.needsRechecking??progress.rechecking],["Not Assessed",detail.summary?.notAssessed??progress.notAssessed],["Total Sample Trees",detail.summary?.total??progress.total],["Completed Assessment Count",detail.summary?.completed??confirmed]].map(([label,value])=><Reference key={label} label={label} value={value}/>)}</dl>
      <p><strong>Sample Survival Result:</strong> {detail.summary?.survivalRate==null?"Pending / Incomplete":`${detail.summary.survivalRate}%`}. Unresolved trees are not classified as dead.</p>
      <label className="psm-field">Overall Visit Remarks (Optional)<textarea value={visitRemarks} maxLength={1000} disabled={saving||readOnly} onChange={event=>onVisitRemarks(event.target.value)} rows={3}/></label></section>
    <section className="psm-section"><h3>8. Actions &amp; Monitoring Visit History</h3>
      <p className="psm-note">Save Tree Assessment, Save Draft and Submit Monitoring Visit actions follow your role and this visit's status.</p>
      <div className="psm-history-table-wrap"><table className="psm-history-table"><caption>Monitoring Visit History</caption><thead><tr><th>Visit</th><th>Due</th><th>Actual</th><th>Status</th><th>Healthy</th><th>Damaged</th><th>Dead</th><th>Rechecking</th><th>Survival</th>{onOpenVisit&&<th>Details</th>}</tr></thead><tbody>{(context?.history||[]).map((row,index)=><tr key={row.visitId||`scheduled-${row.visitNumber}-${index}`}><td>{row.visitNumber??"—"}</td><td>{Number(row.visitNumber)===1?"Not fixed":row.scheduledDueDate||row.visitDate||"—"}</td><td>{row.dateMonitored||"—"}</td><td>{PLAN_STATUS[row.status]||row.status}{row.availability==="NOT_YET_AVAILABLE"?" — Not yet available":""}</td><td>{row.healthy??"—"}</td><td>{row.damaged??"—"}</td><td>{row.confirmedDead??"—"}</td><td>{row.needsRechecking??"—"}</td><td>{row.survivalRate==null?"Pending / Incomplete":`${row.survivalRate}%`}</td>{onOpenVisit&&<td>{row.visitId&&row.visitId!==detail.id&&row.canView===true?<button type="button" disabled={saving} onClick={()=>onOpenVisit(row.visitId)} aria-label={`View visit ${row.visitNumber}`}>View</button>:row.visitId===detail.id?"This visit":"—"}</td>}</tr>)}</tbody></table></div>
      {active&&<div className="psm-tree-timeline"><h4>{active.sampleId} approved history</h4>{(context?.treeTimeline?.[active.sampleId]||[]).length?<ul>{context.treeTimeline[active.sampleId].map(entry=><li key={`${entry.visitId}-${entry.assessedOn}`}>Visit {entry.visitNumber}: {entry.assessedOn||entry.dateMonitored||"date unavailable"} — {entry.condition}{entry.heightCentimeters==null?"":` · ${entry.heightCentimeters} cm`}{entry.stemDiameterMillimeters==null?"":` · ${entry.stemDiameterMillimeters} mm`}</li>)}</ul>:<p>No approved per-tree history is available yet.</p>}</div>}
    </section>
  </>;
}
