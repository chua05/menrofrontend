import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "../services/authenticatedApi";
import "../styles/planting-reports.css";
import "../styles/event-attendance.css";

async function request(path, options) {
  const response = await authenticatedFetch(path, options);
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    throw Object.assign(new Error(body?.message || "The request could not be completed."), { status: response.status, fieldErrors: body?.fieldErrors });
  }
  return body?.data;
}

function formatWhen(value) {
  const seconds = value?._seconds ?? value?.seconds;
  const date = seconds !== undefined ? new Date(Number(seconds) * 1000) : value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) : "—";
}

// Guest attendance for one event. The backend allows only the event's
// requester, MENRO Staff and Admin; Staff/Admin also review legacy seedling
// reservations here and may release an abandoned one with a required reason.
export default function EventAttendancePanel({ eventId, canManageReservations = false, onReservationReleased }) {
  const [attendance, setAttendance] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [releasing, setReleasing] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading"); setError("");
    try {
      const [rows, held] = await Promise.all([
        request(`/events/${encodeURIComponent(eventId)}/attendance`),
        canManageReservations ? request(`/events/${encodeURIComponent(eventId)}/reservations`) : Promise.resolve([]),
      ]);
      setAttendance(Array.isArray(rows) ? rows : []);
      setReservations(Array.isArray(held) ? held : []);
      setStatus("ready");
    } catch (failure) {
      setError(failure.status === 403 ? "Attendance is visible only to the event requester and MENRO Staff and Admin." : failure.message);
      setStatus("error");
    }
  }, [eventId, canManageReservations]);

  useEffect(() => {
    if (!eventId) return undefined;
    let active = true;
    Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; };
  }, [eventId, load]);

  async function release(submitEvent) {
    submitEvent.preventDefault();
    const text = reason.trim();
    if (!text) { setReasonError("Enter the reason for releasing this reservation."); return; }
    setBusy(true); setReasonError("");
    try {
      await request(`/events/${encodeURIComponent(eventId)}/reservations/${encodeURIComponent(releasing.id)}/release`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: text }),
      });
      setReleasing(null); setReason("");
      await load();
      onReservationReleased?.();
    } catch (failure) {
      setReasonError(failure.fieldErrors?.reason || failure.message);
    } finally { setBusy(false); }
  }

  if (!eventId) return null;
  const openReservations = reservations.filter((row) => row.open);
  return (
    <section className="pr-drawer-section pr-event-attendance" aria-label="Event attendance">
      <div className="pr-drawer-section-title">Event Attendance{status === "ready" ? ` (${attendance.length})` : ""}</div>
      {status === "loading" && <p className="pr-helper-text" role="status">Loading attendance…</p>}
      {status === "error" && <p className="pr-helper-text" role="status">{error}</p>}
      {status === "ready" && (attendance.length === 0
        ? <p className="pr-helper-text">No guest attendance has been registered for this event.</p>
        : <div className="pr-attendance-table-wrap"><table className="pr-attendance-table">
          <thead><tr><th scope="col">Full Name</th><th scope="col">Contact Number</th><th scope="col">Address</th><th scope="col">Registered</th></tr></thead>
          <tbody>{attendance.map((row) => <tr key={row.id}><td>{row.fullName}</td><td>{row.contactNumber}</td><td>{row.address}</td><td>{formatWhen(row.registeredAt)}</td></tr>)}</tbody>
        </table></div>)}
      <p className="pr-helper-text">Attendance is documentation only. It does not change seedling balances, planting verification or monitoring.</p>

      {canManageReservations && status === "ready" && reservations.length > 0 && (
        <div className="pr-legacy-reservations" aria-label="Legacy seedling reservations">
          <div className="pr-info-label">Legacy Seedling Reservations</div>
          <p className="pr-helper-text">Reservations from the retired guest contribution workflow. Releasing an abandoned one returns its seedlings to the event's reportable balance; the record and reason are kept.</p>
          <ul className="pr-legacy-reservation-list">
            {reservations.map((row) => (
              <li key={row.id} data-reservation-id={row.id}>
                <span><strong>{row.quantity} × {row.species || "seedlings"}</strong> — {row.contributorName || "Guest"} · {row.reservationStatus}</span>
                {row.reservationStatus === "Released" && <small>Released by {row.reservationReleasedByName || "MENRO"}: {row.reservationReleaseReason}</small>}
                {row.open && releasing?.id !== row.id && <button type="button" className="pr-secondary-button" onClick={() => { setReleasing(row); setReason(""); setReasonError(""); }}>Release Reservation</button>}
                {releasing?.id === row.id && (
                  <form className="pr-reservation-release-form" onSubmit={release} noValidate>
                    <label className="pr-label" htmlFor={`release-reason-${row.id}`}>Reason for releasing <span className="pr-required">*</span></label>
                    <textarea id={`release-reason-${row.id}`} className="pr-textarea" rows={2} maxLength={1000} value={reason} disabled={busy}
                      aria-required="true" aria-invalid={reasonError ? "true" : undefined}
                      onChange={(event) => { setReason(event.target.value); setReasonError(""); }} />
                    {reasonError && <small className="pr-field-error" role="alert">{reasonError}</small>}
                    <div className="pr-drawer-verification-actions">
                      <button type="button" className="pr-secondary-button" onClick={() => setReleasing(null)} disabled={busy}>Cancel</button>
                      <button type="submit" className="pr-warning-button" disabled={busy}>{busy ? "Releasing…" : "Confirm Release"}</button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {openReservations.length === 0 && <p className="pr-helper-text">No open reservations.</p>}
        </div>
      )}
    </section>
  );
}
