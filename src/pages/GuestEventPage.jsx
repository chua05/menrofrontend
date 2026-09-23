import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import logo from "../assets/menro-logo.png";
import { formatDisplayId } from "../utils/displayId";
import "../styles/guest-event.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function GuestEventPage() {
  const { token } = useParams();
  const [event, setEvent] = useState(null);
  const [session, setSession] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [contributionsLoading, setContributionsLoading] = useState(false);
  const [contributionsError, setContributionsError] = useState("");
  const [contributionsRetry, setContributionsRetry] = useState(0);
  const [form, setForm] = useState({ fullName: "", organizationBarangay: "", contactNumber: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadEvent() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE_URL}/guest-events/${encodeURIComponent(token)}`);
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message || "Guest event is unavailable.");
        const data = payload?.data;
        if (!data?.id) throw new Error("Guest event is unavailable.");
        if (cancelled) return;
        setEvent(data);
        const savedToken = sessionStorage.getItem(`menro-guest-session:${data.id}`);
        if (savedToken) {
          const sessionResponse = await fetch(`${API_BASE_URL}/guest-events/session`, {
            headers: { Authorization: `Guest ${savedToken}` },
          });
          const sessionPayload = await sessionResponse.json().catch(() => null);
          if (sessionResponse.ok && sessionPayload?.data?.eventId === data.id) {
            if (!cancelled) setSession({ ...sessionPayload.data, sessionToken: savedToken });
          } else {
            sessionStorage.removeItem(`menro-guest-session:${data.id}`);
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Guest event is unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadEvent();
    return () => { cancelled = true; };
  }, [token, retryKey]);

  useEffect(() => {
    if (!session?.sessionToken) return;
    let cancelled = false;
    async function loadContributions() {
      setContributionsLoading(true);
      setContributionsError("");
      try {
        const response = await fetch(`${API_BASE_URL}/guest-events/session/contributions`, {
          headers: { Authorization: `Guest ${session.sessionToken}` },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message || "Unable to load contributions.");
        if (!cancelled) setContributions(Array.isArray(payload?.data) ? payload.data : []);
      } catch (loadError) {
        if (!cancelled) setContributionsError(loadError.message || "Unable to load contributions.");
      } finally {
        if (!cancelled) setContributionsLoading(false);
      }
    }
    void loadContributions();
    return () => { cancelled = true; };
  }, [session?.sessionToken, contributionsRetry]);

  async function join(eventSubmit) {
    eventSubmit.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/guest-events/${encodeURIComponent(token)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          organizationBarangay: form.organizationBarangay.trim(),
          contactNumber: form.contactNumber.trim(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Unable to join this event.");
      const joined = payload?.data;
      if (!joined?.sessionToken || joined.eventId !== event.id) throw new Error("Unable to start guest session.");
      sessionStorage.setItem(`menro-guest-session:${event.id}`, joined.sessionToken);
      setSession({ ...joined, fullName: form.fullName.trim() });
    } catch (joinError) {
      setError(joinError.message || "Unable to join this event.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="guest-event-page">
      <div className="guest-event-shell">
        <header className="guest-event-brand">
          <img src={logo} alt="MENRO seal" />
          <div><strong>MENRO</strong><span>Environment Office · Juban</span></div>
        </header>

        <article className="guest-event-card" aria-label="Guest event">
          <div className="guest-event-heading">
            <h1>Tree Planting Event</h1>
            <p>View your invitation and join as a guest participant.</p>
          </div>
          <div className="guest-event-divider" />

          {loading && <p className="guest-event-muted" role="status">Loading event...</p>}
          {error && <div className="guest-event-alert" role="alert">{error}</div>}
          {!loading && !event && (
            <button type="button" className="guest-event-button" onClick={() => setRetryKey((count) => count + 1)}>Retry</button>
          )}

          {event && <section className="guest-event-summary" aria-label="Event details">
            <span className="guest-event-status">{event.status}</span>
            <h2>{event.name}</h2>
            <dl className="guest-event-details">
              <div><dt>Date</dt><dd>{event.date || "Not available"}</dd></div>
              <div><dt>Time</dt><dd>{event.startTime && event.endTime ? `${event.startTime}–${event.endTime}` : "Not available"}</dd></div>
              <div><dt>Planting Site</dt><dd>{event.plantingSiteName || event.location || "Not available"}</dd></div>
              <div><dt>Barangay</dt><dd>{event.barangay || "Not available"}</dd></div>
            </dl>
          </section>}

          {event && !session && <section className="guest-event-section" aria-label="Join event">
            <h2>Join this event</h2>
            <p className="guest-event-muted">Enter your details to register for this planting event. No MENRO account is required.</p>
            <form className="guest-event-form" onSubmit={join}>
              <label className="guest-event-field">Full Name *
                <input required maxLength={120} autoComplete="name" value={form.fullName}
                  onChange={(change) => setForm((previous) => ({ ...previous, fullName: change.target.value }))} />
              </label>
              <label className="guest-event-field">Organization / Barangay *
                <input required maxLength={120} value={form.organizationBarangay}
                  onChange={(change) => setForm((previous) => ({ ...previous, organizationBarangay: change.target.value }))} />
              </label>
              <label className="guest-event-field">Contact Number *
                <input required type="tel" inputMode="tel" maxLength={20} autoComplete="tel" value={form.contactNumber}
                  onChange={(change) => setForm((previous) => ({ ...previous, contactNumber: change.target.value }))} />
              </label>
              <button className="guest-event-button" type="submit" disabled={submitting}>
                {submitting ? "Joining..." : "Join Event"}
              </button>
            </form>
          </section>}

          {event && session && <section className="guest-event-section" aria-label="My guest event">
            <h2>You joined this event</h2>
            <p className="guest-event-muted">{session.fullName} is registered for this event. Joining does not confirm physical attendance.</p>
            <h2>My Planting Contributions</h2>
            {contributionsLoading && <p className="guest-event-muted" role="status">Loading your contributions...</p>}
            {contributionsError && <div className="guest-event-alert" role="alert">{contributionsError}</div>}
            {contributionsError && <button type="button" className="guest-event-button" onClick={() => setContributionsRetry((count) => count + 1)}>Retry</button>}
            {!contributionsLoading && !contributionsError && (contributions.length ? <ul className="guest-event-contributions">{contributions.map((item, index) =>
              <li key={item.id || index}><span>{item.species || formatDisplayId("INV", item.inventoryNumber, item.inventoryId)}</span><strong>{item.quantity}</strong></li>
            )}</ul> : <p className="guest-event-muted">No planting contributions recorded yet.</p>)}
          </section>}
        </article>
      </div>
    </main>
  );
}
