import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as exifr from "exifr";
import logo from "../assets/menro-logo.png";
import { formatDisplayId } from "../utils/displayId";
import "../styles/guest-event.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const MAX_PHOTOS = 10;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

function siteLabel(event) {
  const number = event?.plantingSiteNumber || "";
  const name = event?.plantingSiteName || event?.location || "Not available";
  return number ? `${number} — ${name}` : name;
}

function newSubmissionKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function GuestEventPage() {
  const { token } = useParams();
  const mapContainerRef = useRef(null);
  const submissionKeyRef = useRef("");
  const [event, setEvent] = useState(null);
  const [session, setSession] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [contributionsLoading, setContributionsLoading] = useState(false);
  const [contributionsError, setContributionsError] = useState("");
  const [contributionsRetry, setContributionsRetry] = useState(0);
  const [form, setForm] = useState({ fullName: "", contactNumber: "" });
  const [plantingForm, setPlantingForm] = useState({ inventoryId: "", quantity: "" });
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [photoGps, setPhotoGps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [plantingSubmitting, setPlantingSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [plantingMessage, setPlantingMessage] = useState({ type: "", text: "" });
  const [retryKey, setRetryKey] = useState(0);

  const allocations = useMemo(() => Array.isArray(event?.allocation) ? event.allocation : [], [event]);
  const selectedAllocation = allocations.find((item) => item.inventoryId === plantingForm.inventoryId) || null;
  const allRecorded = allocations.length > 0 && allocations.every((item) => Number(item.remaining) === 0);

  async function guestFetch(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(session?.sessionToken ? { Authorization: `Guest ${session.sessionToken}` } : {}),
        ...options.headers,
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || "Unable to complete the request.");
    return payload?.data;
  }

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
            if (!cancelled) {
              setSession({ ...sessionPayload.data, sessionToken: savedToken });
              if (sessionPayload.data.event) setEvent(sessionPayload.data.event);
            }
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
        const data = await guestFetch("/guest-events/session/contributions");
        if (!cancelled) setContributions(Array.isArray(data) ? data : []);
      } catch (loadError) {
        if (!cancelled) setContributionsError(loadError.message || "Unable to load contributions.");
      } finally {
        if (!cancelled) setContributionsLoading(false);
      }
    }
    void loadContributions();
    return () => { cancelled = true; };
  }, [session?.sessionToken, contributionsRetry]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => photoPreviews.forEach((url) => URL.revokeObjectURL(url)), [photoPreviews]);

  useEffect(() => {
    if (!session || !mapContainerRef.current) return undefined;
    const siteLatitude = Number(event?.latitude);
    const siteLongitude = Number(event?.longitude);
    const hasSite = event?.latitude !== null && event?.latitude !== undefined &&
      event?.longitude !== null && event?.longitude !== undefined &&
      Number.isFinite(siteLatitude) && Number.isFinite(siteLongitude);
    const hasPhoto = Number.isFinite(photoGps?.latitude) && Number.isFinite(photoGps?.longitude);
    if (!hasSite && !hasPhoto) return undefined;
    const center = hasPhoto ? [photoGps.latitude, photoGps.longitude] : [siteLatitude, siteLongitude];
    const map = L.map(mapContainerRef.current, { center, zoom: 16, maxZoom: 19 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const points = [];
    if (hasSite) {
      L.circleMarker([siteLatitude, siteLongitude], {
        radius: 8, color: "#fff", weight: 2, fillColor: "#087443", fillOpacity: 1,
      }).bindTooltip("Registered planting site").addTo(map);
      points.push([siteLatitude, siteLongitude]);
    }
    if (hasPhoto) {
      L.circleMarker([photoGps.latitude, photoGps.longitude], {
        radius: 8, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1,
      }).bindTooltip("Photo GPS location").addTo(map);
      points.push([photoGps.latitude, photoGps.longitude]);
    }
    if (points.length > 1) map.fitBounds(points, { padding: [24, 24] });
    window.setTimeout(() => map.invalidateSize(), 0);
    return () => map.remove();
  }, [session, event?.latitude, event?.longitude, photoGps]);

  async function refreshGuestData() {
    const data = await guestFetch("/guest-events/session");
    setSession((previous) => ({ ...previous, ...data }));
    if (data?.event) setEvent(data.event);
    setContributionsRetry((count) => count + 1);
  }

  async function join(eventSubmit) {
    eventSubmit.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/guest-events/${encodeURIComponent(token)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: form.fullName.trim(), contactNumber: form.contactNumber.trim() }),
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

  async function selectPhotos(fileList) {
    setPlantingMessage({ type: "", text: "" });
    const selected = Array.from(fileList || []);
    if (selected.length > MAX_PHOTOS || selected.some((file) => file.size > MAX_PHOTO_SIZE)) {
      setPlantingMessage({ type: "error", text: "Select up to 10 photos, with a maximum size of 10 MB each." });
      return;
    }
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotos(selected);
    setPhotoPreviews(selected.map((file) => URL.createObjectURL(file)));
    setPhotoGps(null);
    for (const file of selected) {
      const gps = await exifr.gps(file).catch(() => null);
      if (Number.isFinite(gps?.latitude) && Number.isFinite(gps?.longitude)) {
        setPhotoGps({ latitude: gps.latitude, longitude: gps.longitude });
        break;
      }
    }
  }

  async function submitPlanting(eventSubmit) {
    eventSubmit.preventDefault();
    setPlantingMessage({ type: "", text: "" });
    const quantity = Number(plantingForm.quantity);
    if (!selectedAllocation) {
      setPlantingMessage({ type: "error", text: "Select a tree or sapling from this event allocation." });
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > Number(selectedAllocation.remaining)) {
      setPlantingMessage({ type: "error", text: `Enter a positive whole number not greater than the current remaining quantity (${selectedAllocation.remaining}).` });
      return;
    }
    setPlantingSubmitting(true);
    try {
      const latestSession = await guestFetch("/guest-events/session");
      if (latestSession?.event) setEvent(latestSession.event);
      const latestAllocation = latestSession?.event?.allocation?.find(
        (item) => item.inventoryId === selectedAllocation.inventoryId
      );
      if (!latestAllocation || quantity > Number(latestAllocation.remaining)) {
        throw new Error("The available planting quantity has changed. Please review the updated remaining quantity and try again.");
      }
      if (!submissionKeyRef.current) submissionKeyRef.current = newSubmissionKey();
      const contribution = await guestFetch("/guest-events/session/contributions", {
        method: "POST",
        body: JSON.stringify({ inventoryId: selectedAllocation.inventoryId, quantity, submissionKey: submissionKeyRef.current }),
      });
      let optionalPhotoWarning = "";
      if (photos.length > 0) {
        const photoData = new FormData();
        photos.forEach((photo) => photoData.append("photos", photo));
        if (/^\d{4}-\d{2}-\d{2}$/.test(event.date || "")) photoData.append("plantingDate", event.date);
        try {
          await guestFetch(`/guest-events/session/contributions/${encodeURIComponent(contribution.id)}/evidence`, {
            method: "POST", body: photoData,
          });
        } catch (photoError) {
          optionalPhotoWarning = `Planting was recorded, but the optional photo was not uploaded: ${photoError.message}`;
        }
      }
      await refreshGuestData();
      setPlantingForm({ inventoryId: "", quantity: "" });
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
      setPhotos([]);
      setPhotoPreviews([]);
      setPhotoGps(null);
      submissionKeyRef.current = "";
      setPlantingMessage({
        type: optionalPhotoWarning ? "warning" : "success",
        text: optionalPhotoWarning || "Your planting record was submitted successfully.",
      });
    } catch (submitError) {
      setPlantingMessage({ type: "error", text: submitError.message || "Unable to submit planting record." });
      await refreshGuestData().catch(() => {});
    } finally {
      setPlantingSubmitting(false);
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
          <div className="guest-event-heading"><h1>Tree Planting Event</h1><p>View your invitation and join as a guest participant.</p></div>
          <div className="guest-event-divider" />
          {loading && <p className="guest-event-muted" role="status">Loading event...</p>}
          {error && <div className="guest-event-alert" role="alert">{error}</div>}
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

          {event && !session && <section className="guest-event-section" aria-label="Join event">
            <h2>Join this event</h2><p className="guest-event-muted">Enter your details to register. No MENRO account is required.</p>
            <form className="guest-event-form" onSubmit={join}>
              <label className="guest-event-field">Full Name *<input required maxLength={120} autoComplete="name" value={form.fullName} onChange={(change) => setForm((previous) => ({ ...previous, fullName: change.target.value }))} /></label>
              <label className="guest-event-field">Contact Number *<input required type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={12} autoComplete="tel" value={form.contactNumber} onChange={(change) => setForm((previous) => ({ ...previous, contactNumber: change.target.value.replace(/\D/g, "").slice(0, 12) }))} /></label>
              <label className="guest-event-field">Barangay<input readOnly value={event.barangay || "Not available"} /></label>
              <label className="guest-event-field">Planting Site<input readOnly value={siteLabel(event)} /></label>
              <button className="guest-event-button" type="submit" disabled={submitting}>{submitting ? "Joining..." : "Join Event"}</button>
            </form>
          </section>}

          {event && session && <>
            <section className="guest-event-section" aria-label="Planting allocation">
              <h2>Trees Planted / Event Allocation</h2>
              {!event.allocationReleased && <div className="guest-event-notice">The event planting allocation has not been released yet.</div>}
              {allocations.length > 0 && <ul className="guest-event-allocation-list">{allocations.map((item) => <li key={item.inventoryId}><strong>{item.species}</strong><span>Allocated: {item.allocated}</span><span>Recorded: {item.recorded}</span><span>Remaining: {item.remaining}</span></li>)}</ul>}
              {allRecorded && <div className="guest-event-notice">All allocated trees for this event have already been recorded as planted.</div>}
            </section>

            <section className="guest-event-section" aria-label="Submit planting record">
              <h2>Planting Record</h2>
              {plantingMessage.text && <div className={`guest-event-alert guest-event-alert-${plantingMessage.type}`} role="alert">{plantingMessage.text}</div>}
              <form className="guest-event-form" onSubmit={submitPlanting}>
                <label className="guest-event-field">Tree / Sapling *<select required value={plantingForm.inventoryId} disabled={!allocations.length || allRecorded} onChange={(change) => setPlantingForm({ inventoryId: change.target.value, quantity: "" })}><option value="">Select from event allocation</option>{allocations.map((item) => <option key={item.inventoryId} value={item.inventoryId} disabled={item.remaining <= 0}>{item.species} ({item.remaining} remaining)</option>)}</select></label>
                <div className="guest-event-quantity-grid">
                  <label className="guest-event-field">Allocated Quantity<input readOnly value={selectedAllocation?.allocated ?? "—"} /></label>
                  <label className="guest-event-field">Remaining Quantity<input readOnly value={selectedAllocation?.remaining ?? "—"} /></label>
                </div>
                <label className="guest-event-field">Quantity of Planted Trees *<input required type="number" min="1" step="1" max={selectedAllocation?.remaining || undefined} value={plantingForm.quantity} disabled={!selectedAllocation || selectedAllocation.remaining <= 0} onChange={(change) => setPlantingForm((previous) => ({ ...previous, quantity: change.target.value }))} /></label>
                <div className="guest-event-evidence">
                  <div><strong>Photo Evidence — Optional</strong><span>You may submit without a photo or GPS location.</span></div>
                  <div className="guest-event-photo-actions">
                    <label className="guest-event-secondary-button">Take Photo<input hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(change) => void selectPhotos(change.target.files)} /></label>
                    <label className="guest-event-secondary-button">Upload Photo<input hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(change) => void selectPhotos(change.target.files)} /></label>
                  </div>
                  {photoPreviews.length > 0 && <div className="guest-event-photo-previews">{photoPreviews.map((url, index) => <img key={url} src={url} alt={`Selected planting evidence ${index + 1}`} />)}</div>}
                  <div className="guest-event-location-copy"><strong>Location — Optional</strong><span>{photoGps ? `Photo GPS: ${photoGps.latitude.toFixed(6)}, ${photoGps.longitude.toFixed(6)}` : "No GPS coordinates found in the selected photo. No photo marker will be shown."}</span></div>
                  {((event.latitude !== null && event.latitude !== undefined &&
                    event.longitude !== null && event.longitude !== undefined &&
                    Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude))) || photoGps) &&
                    <div ref={mapContainerRef} className="guest-event-map" aria-label="Planting site and optional photo location map" />}
                </div>
                <button className="guest-event-button" type="submit" disabled={plantingSubmitting || !selectedAllocation || selectedAllocation.remaining <= 0 || allRecorded}>{plantingSubmitting ? "Submitting..." : "Submit Planting Record"}</button>
              </form>
            </section>

            <section className="guest-event-section" aria-label="My guest contributions">
              <h2>My Planting Contributions</h2>
              {contributionsLoading && <p className="guest-event-muted" role="status">Loading your contributions...</p>}
              {contributionsError && <div className="guest-event-alert" role="alert">{contributionsError}</div>}
              {contributionsError && <button type="button" className="guest-event-button" onClick={() => setContributionsRetry((count) => count + 1)}>Retry</button>}
              {!contributionsLoading && !contributionsError && (contributions.length ? <ul className="guest-event-contributions">{contributions.map((item, index) => <li key={item.id || index}><span>{item.species || formatDisplayId("INV", item.inventoryNumber, item.inventoryId)}</span><strong>{item.quantity}</strong></li>)}</ul> : <p className="guest-event-muted">No planting contributions recorded yet.</p>)}
            </section>
          </>}
        </article>
      </div>
    </main>
  );
}
