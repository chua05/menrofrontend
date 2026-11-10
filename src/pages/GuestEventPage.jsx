import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import logo from "../assets/menro-logo.png";
import { guestAttendanceErrors, normalizeGuestContact, attendanceOpensLabel } from "../utils/guestAttendance";
import "../styles/guest-event.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const EMPTY_FORM = { fullName: "", contactNumber: "", address: "" };

function siteLabel(event) {
  const number = event?.plantingSiteNumber || "";
  const name = event?.plantingSiteName || "Not available";
  return number ? `${number} — ${name}` : name;
}

// Event-specific attendance registration through the requester's guest link.
// Guests record attendance only (Full Name, Contact Number, Address); planting
// details belong to the event's final planting report, not to guests.
export default function GuestEventPage() {
  const { token } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadEvent() {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch(`${API_BASE_URL}/guest-events/${encodeURIComponent(token)}`);
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.data?.id) throw new Error(payload?.message || "This event link is unavailable.");
        if (!cancelled) setEvent(payload.data);
      } catch (error) {
        if (!cancelled) { setEvent(null); setLoadError(error.message || "This event link is unavailable."); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadEvent();
    return () => { cancelled = true; };
  }, [token, retryKey]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setSubmitError("");
  }

  async function register(submitEvent) {
    submitEvent.preventDefault();
    if (submitting) return;
    const validation = guestAttendanceErrors(form);
    setErrors(validation);
    if (Object.keys(validation).length) {
      document.getElementById(`guest-${Object.keys(validation)[0]}`)?.focus();
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch(`${API_BASE_URL}/guest-events/${encodeURIComponent(token)}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: form.fullName.trim(), contactNumber: normalizeGuestContact(form.contactNumber), address: form.address.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (payload?.fieldErrors) setErrors(payload.fieldErrors);
        throw new Error(payload?.message || "Attendance could not be recorded. Please try again.");
      }
      setRegistered({ fullName: payload?.data?.fullName || form.fullName.trim() });
      setForm(EMPTY_FORM);
    } catch (error) {
      setSubmitError(error.message || "Attendance could not be recorded. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (field) => errors[field] && <small id={`guest-${field}-error`} className="guest-event-field-error" role="alert">{errors[field]}</small>;
  const describedBy = (field) => (errors[field] ? `guest-${field}-error` : undefined);

  return (
    <main className="guest-event-page">
      <div className="guest-event-shell">
        <header className="guest-event-brand">
          <img src={logo} alt="MENRO seal" />
          <div><strong>MENRO</strong><span>Environment Office · Bulan</span></div>
        </header>
        <article className="guest-event-card" aria-label="Guest event attendance">
          <div className="guest-event-heading"><h1>Tree Planting Event Attendance</h1><p>Register your attendance at this planting event.</p></div>
          <div className="guest-event-divider" />
          {loading && <p className="guest-event-muted" role="status">Loading event...</p>}
          {loadError && <div className="guest-event-alert" role="alert">{loadError}</div>}
          {!loading && !event && <button type="button" className="guest-event-button" onClick={() => setRetryKey((count) => count + 1)}>Retry</button>}

          {event && <section className="guest-event-summary" aria-label="Event details">
            <span className="guest-event-status">{event.status}</span><h2>{event.name}</h2>
            <dl className="guest-event-details">
              <div><dt>Date</dt><dd>{event.date || "Not available"}</dd></div>
              <div><dt>Time</dt><dd>{event.startTime && event.endTime ? `${event.startTime}–${event.endTime}` : "Not available"}</dd></div>
              <div><dt>Planting Site</dt><dd>{siteLabel(event)}</dd></div>
              <div><dt>Barangay</dt><dd>{event.barangay || "Not available"}</dd></div>
            </dl>
          </section>}

          {event && registered && <section className="guest-event-section guest-attendance-success" aria-label="Attendance recorded" role="status">
            <h2>Attendance recorded</h2>
            <p>Thank you, {registered.fullName}. Your attendance at this planting event has been recorded.</p>
            <button type="button" className="guest-event-secondary-button" onClick={() => setRegistered(null)}>Register another attendee</button>
          </section>}

          {event && !registered && !event.attendanceOpen && <section className="guest-event-section" aria-label="Attendance not open">
            <div className="guest-event-notice" role="status">Attendance opens when the planting event starts{attendanceOpensLabel(event.attendanceOpensAt)}.</div>
          </section>}

          {event && !registered && event.attendanceOpen && <section className="guest-event-section" aria-label="Register attendance">
            <h2>Register attendance</h2>
            <p className="guest-event-muted">No MENRO account is required. Your details are visible only to the event requester and MENRO Staff and Admin.</p>
            {submitError && <div className="guest-event-alert" role="alert">{submitError}</div>}
            <form className="guest-event-form" onSubmit={register} noValidate>
              <label className="guest-event-field" htmlFor="guest-fullName">Full Name *
                <input id="guest-fullName" required maxLength={120} autoComplete="name" value={form.fullName}
                  aria-invalid={errors.fullName ? "true" : undefined} aria-describedby={describedBy("fullName")}
                  onChange={(change) => update("fullName", change.target.value)} />
              </label>
              {fieldError("fullName")}
              <label className="guest-event-field" htmlFor="guest-contactNumber">Contact Number *
                <input id="guest-contactNumber" required type="tel" inputMode="numeric" maxLength={13} autoComplete="tel" placeholder="09XXXXXXXXX" value={form.contactNumber}
                  aria-invalid={errors.contactNumber ? "true" : undefined} aria-describedby={describedBy("contactNumber")}
                  onChange={(change) => update("contactNumber", change.target.value.replace(/[^\d+]/g, "").slice(0, 13))} />
              </label>
              {fieldError("contactNumber")}
              <label className="guest-event-field" htmlFor="guest-address">Address *
                <textarea id="guest-address" required rows={2} maxLength={200} autoComplete="street-address" placeholder="Purok / Street, Barangay, Municipality" value={form.address}
                  aria-invalid={errors.address ? "true" : undefined} aria-describedby={describedBy("address")}
                  onChange={(change) => update("address", change.target.value)} />
              </label>
              {fieldError("address")}
              <button className="guest-event-button" type="submit" disabled={submitting}>{submitting ? "Registering..." : "Register Attendance"}</button>
            </form>
          </section>}
        </article>
      </div>
    </main>
  );
}
