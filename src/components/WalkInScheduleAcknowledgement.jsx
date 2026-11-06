import { useRef, useState } from "react";
import { authenticatedFetch } from "../services/authenticatedApi";
import { focusFirstInvalid } from "../utils/formValidation";

// Citizens remain account-free. This records a Staff-encoded signed document,
// never a fabricated citizen login or an automatic schedule approval.
export default function WalkInScheduleAcknowledgement({ request, onSaved }) {
  const late = ["AwaitingRequester", "ReturnedForRevision"].includes(request.lateReleaseRescheduling?.status);
  const schedule = late ? request.lateReleaseRescheduling.requesterProposal || {} : request.preApprovalSchedule || {};
  const [date, setDate] = useState(schedule.plantingDate || ""), [time, setTime] = useState(schedule.startTime || "08:00");
  const [receipt, setReceipt] = useState(""), [file, setFile] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const form = useRef(null), operation = useRef(crypto.randomUUID());
  const change = setter => event => { setter(event.target.value); setErrors({}); operation.current = crypto.randomUUID(); };
  async function save(event) {
    event.preventDefault(); if (busy) return;
    const invalid = { ...(!date ? { date: "Enter the acknowledged planting date." } : {}), ...(!time ? { time: "Enter the acknowledged start time." } : {}), ...(!receipt.trim() ? { receipt: "Enter the signed receipt reference." } : {}), ...(!file ? { file: "Attach the citizen's signed schedule acknowledgement." } : {}) };
    setErrors(invalid); if (Object.keys(invalid).length) return focusFirstInvalid(() => form.current);
    setBusy(true); setError("");
    try {
      const data = new FormData(); data.append("request", JSON.stringify({ action: late ? "late-proposal" : "confirm", expectedVersion: request.requestVersion,
        proposalVersion: request.preApprovalSchedule?.proposalVersion, reschedulingVersion: request.lateReleaseRescheduling?.version,
        plantingDate: date, startTime: time, endTime: schedule.endTime || "", receiptReference: receipt.trim(), clientSubmissionId: operation.current }));
      data.append("acknowledgement", file);
      const response = await authenticatedFetch(`/seedling-requests/walk-in/${encodeURIComponent(request.id)}/schedule`, { method: "PATCH", body: data });
      const body = await response.json(); if (!response.ok) throw new Error(body.message || "Schedule acknowledgement failed.");
      await onSaved(body.data);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  const aria = key => ({ "aria-invalid": errors[key] ? "true" : undefined, "aria-describedby": errors[key] ? `walk-in-schedule-${key}-error` : undefined });
  const feedback = key => errors[key] && <small id={`walk-in-schedule-${key}-error`} className="sr-field-error" role="alert">{errors[key]}</small>;
  return <form ref={form} onSubmit={save} noValidate className="sr-form-grid" aria-label="Signed walk-in schedule acknowledgement">
    <h3 className="full-width">Record Signed Walk-in Schedule</h3>
    <p className="full-width">Record the citizen's signed acknowledgement. Replacement schedules still require the existing independent Staff decision; this does not approve the request.</p>
    <div className="sr-form-field"><label htmlFor="walk-in-schedule-date">Acknowledged Planting Date</label><input id="walk-in-schedule-date" {...aria("date")} type="date" disabled={busy} value={date} onChange={change(setDate)} />{feedback("date")}</div>
    <div className="sr-form-field"><label htmlFor="walk-in-schedule-time">Acknowledged Start Time</label><input id="walk-in-schedule-time" {...aria("time")} type="time" disabled={busy} value={time} onChange={change(setTime)} />{feedback("time")}</div>
    <div className="sr-form-field"><label htmlFor="walk-in-schedule-receipt">Schedule Receipt Reference</label><input id="walk-in-schedule-receipt" {...aria("receipt")} maxLength={120} disabled={busy} value={receipt} onChange={change(setReceipt)} />{feedback("receipt")}</div>
    <div className="sr-form-field"><label htmlFor="walk-in-schedule-file">Signed Schedule Acknowledgement</label><input id="walk-in-schedule-file" {...aria("file")} type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={event => { setFile(event.target.files?.[0] || null); setErrors({}); operation.current = crypto.randomUUID(); }} />{feedback("file")}</div>
    {error && <p className="full-width" role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? "Recording…" : "Record Signed Schedule Acknowledgement"}</button>
  </form>;
}
