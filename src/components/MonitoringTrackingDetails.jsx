import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { FiX } from "react-icons/fi";
import { formatDisplayId } from "../utils/displayId";
import { MONITORING_ID_NOT_ASSIGNED } from "../utils/monitoringRecordView";

// Same presentation as the Survival Monitoring page's dates.
const formatDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "";
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(`${value}T00:00:00`));
};
const Item = ({ label, value }) => <div><span>{label}</span><strong>{value ?? "—"}</strong></div>;

// Monitoring Record Details for a read-only tracking row: an Admin-verified planting report that has no
// monitoring record yet. It reuses the Survival Monitoring details drawer layout and shows only stored
// facts. There are no monitoring actions here; observations are recorded only through authorized
// Staff monitoring once a record or visit exists.
export default function MonitoringTrackingDetails({ row, userRole, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!row) return null;
  const quantity = row.verifiedPlantedQuantity ?? "Not recorded";
  return (
    <div className="sm-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="sm-details-drawer" role="dialog" aria-modal="true" aria-labelledby="sm-tracking-details-title" data-tracking-details={row.plantingReportId}>
        <div className="sm-drawer-header">
          <div>
            <h2 id="sm-tracking-details-title">Monitoring Record Details</h2>
            <div className="sm-drawer-meta">
              <span className="sm-tracking-badge">Tracking only</span>
              <span>Monitoring ID: {MONITORING_ID_NOT_ASSIGNED}</span>
            </div>
          </div>
          <button ref={closeRef} type="button" className="sm-modal-close" onClick={onClose} aria-label="Close monitoring record details">
            <FiX size={19} />
          </button>
        </div>

        <div className="sm-drawer-body">
          <section className="sm-detail-section">
            <h3>Record</h3>
            <div className="sm-detail-grid">
              <Item label="Monitoring ID" value={MONITORING_ID_NOT_ASSIGNED} />
              <Item label="Record Type" value="Verified planting report — no monitoring record yet" />
              <Item label="Planting Report ID" value={formatDisplayId("RPT", row.reportNumber, row.plantingReportId)} />
              <Item label="Verified Planted Quantity" value={quantity} />
            </div>
          </section>

          <section className="sm-detail-section">
            <h3>Planting Site</h3>
            <div className="sm-detail-grid">
              <Item label="Planting Site" value={row.siteName || "Site not recorded"} />
              <Item label="Barangay" value={row.barangay || "Not recorded"} />
              <Item label="Planting Date" value={formatDate(row.plantingDate) || "Not recorded"} />
            </div>
          </section>

          <section className="sm-detail-section">
            <h3>Monitoring Policy and Readiness</h3>
            <div className="sm-detail-grid">
              <Item label="Monitoring Requirement" value={row.requirement} />
              <Item label="Status" value={row.stage} />
              <Item label="Readiness" value={row.status} />
              {row.setup && <Item label="Setup Progress" value={row.setup} />}
            </div>
            {row.notes.map((note) => <p key={note} className="sm-helper">{note}</p>)}
            {row.reasons.length > 0 && (
              <ul className="sm-helper" aria-label="Why monitoring cannot start yet">
                {row.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            )}
          </section>

          <section className="sm-detail-section">
            <h3>Schedule</h3>
            <div className="sm-detail-grid">
              <Item label="Start Monitoring Date" value={row.startMonitoringDate ? formatDate(row.startMonitoringDate) : row.startLabel} />
              <Item label="Next Monitoring Date" value={row.nextLabel} />
            </div>
            <p className="sm-helper">Monitoring dates come only from an approved monitoring schedule; none is assumed for this report.</p>
          </section>

          <section className="sm-detail-section">
            <h3>Latest Observed Condition</h3>
            <p className="sm-helper">Not yet monitored.</p>
          </section>

          <section className="sm-detail-section sm-detail-section-last">
            <h3>Monitoring History</h3>
            <p className="sm-helper">No monitoring observations have been submitted for this planting report.</p>
            <p className="sm-helper">
              <Link to={`/${userRole}/planting-reports?report=${encodeURIComponent(row.plantingReportId)}`}>Open the verified planting report</Link>
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
