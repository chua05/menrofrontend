import { useState } from "react";
import MonitoringInformationPanel from "./MonitoringInformationPanel";
import { informationEnabled } from "../utils/permanentSampleFeatures";
import { Camera, Image, MapPin, Trees, ChevronLeft, ChevronRight } from "lucide-react";
import PlantingLocationMap from "./PlantingLocationMap";
import { SAMPLE_CONDITIONS, sampleProgress } from "../utils/sampleMonitoringForm";
const shown = value => value === null || value === undefined || value === "" ? "Not available" : String(value);
const definitions = { Healthy: "Living tree in good condition.", Damaged: "Living tree with observed damage.", Dead: "Confirmed dead by field assessment.", "Needs Rechecking": "Condition is not yet confirmed." };
function Reference({ label, value }) { return <div><dt>{label}</dt><dd>{shown(value)}</dd></div>; }
export default function PermanentSampleVisitForm({ detail, assessments, activeTreeId, onTree, errors, onChange, onSave,
  saving, onCapture, onUpload, originalEnabled = false, onOriginal, pendingFor, onDiscard, onView, evidenceUrls, evidenceKey, visitRemarks, onVisitRemarks, dateMonitored, onDateMonitored, questions, onQuestion, readOnly = false }) {
  const [clarifications, setClarifications] = useState({});
  const context=detail.visitContext, progress=sampleProgress(assessments);
  const active=assessments.find(row=>row.sampleId===activeTreeId);
  const index=assessments.findIndex(row=>row.sampleId===active?.sampleId);
  const sample=context?.samples?.find(row=>row.sampleId===active?.sampleId);
  const server=detail.sampleAssessments?.find(row=>row.sampleId===active?.sampleId), pending=active && pendingFor(active.sampleId);
  const previous=sample?.previous || sample?.baseline;
  const input = (field, caption, kind="input") => {
    const id=`sample-${active.sampleId}-${field}`, message=errors[`${active.sampleId}.${field}`];
    const props={id, value:active[field], disabled:saving||readOnly, "aria-invalid":Boolean(message), "aria-describedby":message?`${id}-error`:undefined,
      onChange:event=>onChange(active.sampleId,field,event.target.value)};
    return <div className="psm-field" data-validation-field={`${active.sampleId}.${field}`}><label htmlFor={id}>{caption}</label>
      {kind==="textarea"?<textarea {...props} maxLength={1000} rows={3}/>:<input {...props} type="number" min="0" step="any"/>}
      {message&&<small role="alert" id={`${id}-error`}>{message}</small>}</div>;
  };
  return <>
    <section className="psm-section"><h3>1. Verified Planting Site Information</h3>
      <dl className="psm-info"><Reference label="Planting Report ID" value={context?.reportNumber||context?.plantingReportId}/><Reference label="Planting Site" value={context?.siteName}/>
        <Reference label="Address / Barangay" value={context?.barangay}/><Reference label="Planting Report Status" value={context?.reportStatus}/>
        <Reference label="Planting Date" value={context?.plantingDate}/><Reference label="Verified Planted Quantity" value={context?.verifiedPlantedQuantity}/>
        <Reference label="Approved Sample Target" value={context?.approvedSampleTarget}/><Reference label="Sampling Plan Status" value={context?.planStatus}/>
        <Reference label="Registered Sample Trees" value={context?.registeredSampleTrees??assessments.length}/>
        <Reference label="Species" value={context?.samples?.map(row=>row.species).filter(Boolean).filter((value,index,all)=>all.indexOf(value)===index).join(", ")}/></dl>
      {context && (context.planStatus!=="APPROVED"||context.baselineStatus!=="APPROVED")&&<p role="alert">An approved sampling plan and baseline are required before official submission.</p>}
    </section>
    <section className="psm-section"><h3>2. Monitoring Summary &amp; Automatic Schedule</h3><dl className="psm-info">
      <Reference label="Start Monitoring Date" value={context?.schedule?.startMonitoringDate||"Awaiting an approved schedule"}/>
      <Reference label="Next Monitoring Date" value={context?.schedule?.nextMonitoringDate||"Awaiting an approved schedule"}/>
      <Reference label="Monitoring Visit Number" value={context?.schedule?.visitNumber||"Not assigned"}/><Reference label="Schedule Status" value={context?.schedule?.status||"No official schedule supplied"}/></dl>
      <div className="psm-field"><label htmlFor="sample-date-monitored">Date Monitored *</label><input id="sample-date-monitored" type="date" required value={dateMonitored} disabled={saving||readOnly} aria-invalid={Boolean(errors.dateMonitored)} aria-describedby={errors.dateMonitored?"sample-date-monitored-error":undefined} onChange={event=>onDateMonitored(event.target.value)}/>{errors.dateMonitored&&<small role="alert" id="sample-date-monitored-error">{errors.dateMonitored}</small>}</div>
      <p className="psm-note">Scheduled dates come from the authorized visit. Recording the actual assessment date does not change the approved schedule.</p>
    </section>
    <section className="psm-section"><h3>3. Assessment Progress</h3><div className="psm-progress">
      <span>Assessed: {progress.assessed}</span><span>Needs Rechecking: {progress.rechecking}</span><span>Not Assessed: {progress.notAssessed}</span><span>Total Registered Sample Trees: {progress.total}</span></div>
      <progress aria-label="Sample assessment progress" value={progress.assessed} max={progress.total||1}/><p role="status">{progress.assessed}/{progress.total} assessments recorded.</p>
    </section>
    <section className="psm-section"><h3>4. Permanent Sample Tree Records</h3><div className="psm-tree-list">{assessments.map(row=>{
      const reference=context?.samples?.find(item=>item.sampleId===row.sampleId);
      return <button type="button" key={row.sampleId} aria-expanded={row.sampleId===active?.sampleId} aria-controls="sample-active-assessment" onClick={()=>onTree(row.sampleId===active?.sampleId?"":row.sampleId)}>
        <span><strong>{row.sampleId}</strong>{reference?.species&&` - ${reference.species}`}</span><span>{row.condition||"Not Assessed"}{row.previousAssessmentReference||row.recheckRequired?" - Rechecking reference":""}</span></button>;
    })}</div></section>
    {!active&&<section id="sample-active-assessment" hidden /> }
    {active&&<section className="psm-section" id="sample-active-assessment"><h3>5. Individual Tree Assessment</h3><fieldset className="psm-tree" key={active.sampleId}><legend>{active.sampleId}</legend>
      <h4>Previous Assessment Reference</h4>{previous?<dl className="psm-info"><Reference label="Previous Assessment Date" value={previous.date}/><Reference label="Previous Condition" value={previous.condition}/>
        <Reference label="Previous Height (cm)" value={previous.heightCentimeters}/><Reference label="Previous Diameter (cm)" value={previous.diameterCentimeters}/>
        <Reference label="Previous Remarks" value={previous.remarks}/><Reference label="Registered GPS" value={sample?.latitude!=null&&sample?.longitude!=null?`${sample.latitude}, ${sample.longitude}`:null}/></dl>
        :<p>No previous assessment was supplied. Baseline registration remains in Permanent Sample Selection and Baselines.</p>}
      {active.previousAssessmentReference&&<p>Previous assessment: {active.previousAssessmentReference.condition} {active.previousAssessmentReference.remarks}</p>}
      {(sample?.previous?.evidence || Array.from({length:sample?.baseline?.photoCount||0},(_,index)=>({index}))).map(photo=>{
        const source=sample.previous?.visitId||"baseline", key=evidenceKey(active.sampleId,photo.index,source);
        return evidenceUrls[key]?<img key={key} style={{maxWidth:"100%",maxHeight:220}} src={evidenceUrls[key]} alt={`Previous verified photo for ${active.sampleId}`}/>:<button key={key} type="button" onClick={()=>onView(active.sampleId,photo.index,source)}>View previous verified photo {photo.index+1}</button>;
      })}
      <h4 className="psm-heading"><Camera size={18}/> Monitoring Photo</h4><div className="psm-photo-box"><Camera size={28}/><strong>Monitoring Photo Evidence</strong>
        <p>Private verified evidence for {active.sampleId}.</p><div className="psm-actions">
          {!readOnly&&<button type="button" className="psm-primary" disabled={saving} onClick={()=>onCapture(active.sampleId)} aria-label={`Capture verified photo for ${active.sampleId}`}><Camera size={17}/> Take Photo</button>}
          <button type="button" disabled={!originalEnabled||saving||readOnly} onClick={()=>document.getElementById(`sample-${active.sampleId}-original-file`)?.click()} aria-describedby={`sample-${active.sampleId}-original-policy`} title="Original-photo verification rules are awaiting MENRO approval."><Image size={17}/> Upload Existing Photo</button>
          {originalEnabled && <input id={`sample-${active.sampleId}-original-file`} type="file" accept="image/jpeg,.jpg,.jpeg" hidden disabled={!originalEnabled||saving||readOnly} onChange={event=>{onOriginal?.(active.sampleId,event.target.files?.[0]);event.target.value="";}}/>}</div>
        <p className="psm-note" id={`sample-${active.sampleId}-original-policy`}>{originalEnabled ? "Local proposed policy: original JPEG EXIF GPS and capture date are checked by the server. GPS accuracy remains Unknown and requires explicit Admin review. EXIF does not prove authenticity." : "Existing-photo uploads are awaiting MENRO approval of original-photo verification rules. Use Take Photo."}</p></div>
      {pending&&<div className="psm-preview"><img src={pending.previewUrl} alt={`${pending.descriptor.source === "uploaded-original" ? "Original photo" : "Verified evidence"} preview for ${active.sampleId}`}/><p role="status">{pending.descriptor.source === "uploaded-original" ? "Original photo selected ? backend verification and private upload required." : "Verified photo ready for private upload."}</p>
        <button type="button" disabled={saving} onClick={()=>onDiscard(active.sampleId)}>Remove pending photo</button></div>}
      <h4 className="psm-heading"><MapPin size={18}/> Photo Location Verification</h4><div className="psm-location"><div className="psm-location-title"><strong>Location Verification</strong>
        <button type="button" disabled={!pending||saving||readOnly} onClick={()=>onUpload(active.sampleId)} aria-label={`${pending?.descriptor.source === "uploaded-original" ? "Verify and upload original photo" : "Upload verified photo"} for ${active.sampleId}`}>{saving?"Verifying...":"Verify Photo Location"}</button></div>
        <p>{pending?.descriptor.source === "uploaded-original" ? "Original EXIF location must be validated by the server. GPS accuracy: Unknown; Admin review required." : pending?"Location comes from the backend-verified camera capture, not fabricated EXIF.":"Secure camera photos use their separately verified capture location."}</p>
        <PlantingLocationMap key={`${detail.id}-${active.sampleId}`} site={context?.site||null} registeredTree={sample} evidence={pending?.location||server?.evidenceHistory?.at(-1)?.location||null} status={{type:pending?.verification?.accuracyStatus === "UNKNOWN" || server?.evidenceHistory?.at(-1)?.source === "uploaded-original" ? "warning" : pending?.location||server?.evidenceHistory?.at(-1)?.location?"success":"info",label:pending?.verification?.accuracyStatus === "UNKNOWN" || server?.evidenceHistory?.at(-1)?.source === "uploaded-original" ? "EXIF location checked; GPS accuracy Unknown; Admin review required" : pending?.location?"Location checked - private upload pending":server?.evidenceHistory?.at(-1)?.location?"Evidence location recorded":"Awaiting evidence"}}/>
        {pending?.location&&<p>Evidence GPS: {pending.location.latitude}, {pending.location.longitude}. Accuracy: {pending.location.accuracyMeters!=null||pending.location.accuracy!=null?`${pending.location.accuracyMeters??pending.location.accuracy} m`:"Unknown; Admin review required"}</p>}
        {errors[active.sampleId + ".evidence"]&&<p role="alert">{errors[active.sampleId + ".evidence"]}</p>}
        <p className="psm-note">Geotagging verifies evidence location. Staff determines the tree's biological condition.</p></div>
      <div className="psm-history">{(server?.evidenceHistory||[]).map((evidence,n)=>{const key=evidenceKey(active.sampleId,n);return <div key={key}><p>Historical evidence revision {evidence.revision}{evidence.source === "uploaded-original" ? " - Uploaded original - GPS accuracy Unknown - Requires Admin review" : ""}</p>{evidenceUrls[key]?<img src={evidenceUrls[key]} alt={`Private evidence for ${active.sampleId}, revision ${evidence.revision}`}/>:<button type="button" onClick={()=>onView(active.sampleId,n)}>View private evidence revision {evidence.revision}</button>}</div>;})}</div>
      <h4>Tree Measurements &amp; Condition</h4><div className="psm-measurements">{input("heightCentimeters","Height (cm)")}{input("diameterCentimeters","Diameter (cm)")}</div>
      <div className="psm-field" data-validation-field={`${active.sampleId}.condition`}><label htmlFor={`sample-${active.sampleId}-condition`}>Condition</label>
        <select id={`sample-${active.sampleId}-condition`} value={active.condition} disabled={saving||readOnly} aria-invalid={Boolean(errors[`${active.sampleId}.condition`])} aria-describedby={errors[`${active.sampleId}.condition`]?`sample-${active.sampleId}-condition-error`:undefined} onChange={event=>onChange(active.sampleId,"condition",event.target.value)}>
          <option value="">Select condition</option>{SAMPLE_CONDITIONS.map(value=><option key={value}>{value}</option>)}</select>
        {active.condition&&<p>{definitions[active.condition]}</p>}{errors[`${active.sampleId}.condition`]&&<small role="alert" id={`sample-${active.sampleId}-condition-error`}>{errors[`${active.sampleId}.condition`]}</small>}</div>
      {input("remarks",active.condition==="Needs Rechecking"?"Assessment Remarks *":"Remarks","textarea")}
      {questions[active.sampleId]?.trim() && (active.condition !== "Needs Rechecking" || !clarifications[active.sampleId]) && <div className="psm-note">
        <p>Unsent requester question: {questions[active.sampleId]}</p>
        <button type="button" data-discard-question="" disabled={saving||readOnly} aria-label={`Discard unsent question for ${active.sampleId}`} onClick={()=>onQuestion(active.sampleId,"")}>Discard unsent question</button>
      </div>}
      {active.condition==="Needs Rechecking"&&<section className="psm-rechecking"><h3>6. Rechecking &amp; Requester Clarification</h3><p>Rechecking required. Follow-up: {context?.schedule?.nextMonitoringDate||"Awaiting the next approved scheduled visit"}.</p>
        <label className="psm-field">Investigation outcome<select value={active.investigationOutcome} disabled={saving||readOnly} onChange={event=>onChange(active.sampleId,"investigationOutcome",event.target.value)}><option value="">No outcome recorded</option><option>Not Located After Rechecking</option></select></label>
        {active.investigationOutcome&&input("searchFindings","Search findings","textarea")}
        <label><input type="checkbox" checked={Boolean(clarifications[active.sampleId])} disabled={!informationEnabled() || server?.condition !== "Needs Rechecking" || saving || readOnly} onChange={event=>setClarifications(current=>({...current,[active.sampleId]:event.target.checked}))}/> Request additional information from Requester</label>
        {!informationEnabled() ? <p className="psm-note">Requester information is not enabled for this environment.</p> : server?.condition !== "Needs Rechecking" ? <p className="psm-note">Save the rechecking assessment before requesting information.</p> : clarifications[active.sampleId] && <MonitoringInformationPanel key={active.sampleId} visitId={detail.id} sampleId={active.sampleId} assessmentRevision={server.assessmentRevision||0} readOnly={readOnly} draftQuestion={questions[active.sampleId]||""} onDraftQuestion={value=>onQuestion(active.sampleId,value)}/>}</section>}
      {!readOnly&&<button type="button" disabled={saving} onClick={()=>onSave(false)}>Save {active.sampleId} Draft</button>}
      <div className="psm-tree-nav"><button type="button" disabled={index<=0} onClick={()=>onTree(assessments[index-1].sampleId)}><ChevronLeft size={17}/> Previous Tree</button><button type="button" disabled={index>=assessments.length-1} onClick={()=>onTree(assessments[index+1].sampleId)}>Next Tree <ChevronRight size={17}/></button></div>
    </fieldset></section>}
    <section className="psm-section"><h3 className="psm-heading"><Trees size={18}/> 7. Monitoring Visit Summary</h3><dl className="psm-info">{[["Healthy",progress.healthy],["Damaged (Living)",progress.damaged],["Confirmed Dead",progress.dead],["Needs Rechecking",progress.rechecking],["Not Assessed",progress.notAssessed],["Total Registered Sample Trees",progress.total]].map(([label,value])=><Reference key={label} label={label} value={value}/>)}</dl>
      <p>Official Sample Survival Status: Pending applicable policy / Admin review. Unresolved trees are not classified as dead.</p>
      <label className="psm-field">Overall Visit Remarks (Optional)<textarea value={visitRemarks} maxLength={1000} disabled={saving||readOnly} onChange={event=>onVisitRemarks(event.target.value)} rows={3}/></label></section>
  </>;
}
