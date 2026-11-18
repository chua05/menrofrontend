import { FiClipboard, FiX } from "react-icons/fi";
import ModalDialog from "./ModalDialog";
import { formatDisplayId } from "../utils/displayId";
import { MONITORING_ID_NOT_ASSIGNED } from "../utils/monitoringRecordView";

// Same presentation as the Survival Monitoring page's dates.
const formatDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "";
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(`${value}T00:00:00`));
};

function Info({ label, value }) {
  return <div className="sm-record-info-block"><div className="sm-record-info-label">{label}</div><div className="sm-record-info-value">{value}</div></div>;
}

// Monitoring Record Details for a verified planting report that has no monitoring record yet.
// Centered popup with the same modal behavior and layout as View Planting Report (Escape, focus
// containment, background scroll lock and focus restore come from ModalDialog). Read-only: no
// monitoring, review or editing actions; nothing here is a submitted observation.
export default function MonitoringTrackingDetails({ row, onClose }) {
  if (!row) return null;
  const site = row.siteName ? `${row.siteName}${row.barangay ? `, Barangay ${row.barangay}` : ""}` : "Site not recorded";
  return (
    <ModalDialog label="Monitoring Record Details" className="sm-record-dialog" onClose={onClose} returnFocusSelector=".sm-records-card">
      <div className="sm-record-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <section className="sm-record-modal" data-tracking-details={row.plantingReportId}>
          <div className="sm-record-modal-header">
            <div>
              <h2 className="sm-record-modal-title">Monitoring Record Details</h2>
              <p className="sm-record-modal-subtitle">Survival Monitoring</p>
            </div>
            <button type="button" className="sm-record-modal-close" data-modal-close aria-label="Close monitoring record details">
              <FiX size={20} />
            </button>
          </div>

          <div className="sm-record-modal-body">
            <div className="sm-record-summary">
              <div>
                <div className="sm-record-info-label">Monitoring ID</div>
                <div className="sm-record-summary-id">{MONITORING_ID_NOT_ASSIGNED}</div>
              </div>
              <span className="sm-record-status-badge">{row.stage}</span>
            </div>

            <div className="sm-record-info-grid">
              <Info label="Planting Report ID" value={formatDisplayId("RPT", row.reportNumber, row.plantingReportId)} />
              <Info label="Planting Site" value={site} />
              <Info label="Monitoring Method" value={row.requirement} />
              <Info label="Start Monitoring Date" value={row.startMonitoringDate ? formatDate(row.startMonitoringDate) : row.startLabel} />
              <Info label="Next Monitoring Date" value={row.nextLabel} />
              <Info label="Latest Condition" value="Not yet monitored" />
            </div>
            {/* The specific setup blocker (stored policy/readiness), shown once and briefly. */}
            <p className="sm-setup-blocker" role="note">Setup status: {row.status}</p>

            <section className="sm-record-history" aria-labelledby="sm-record-history-title">
              <h3 id="sm-record-history-title">Monitoring History</h3>
              <div className="sm-record-history-empty">
                <FiClipboard size={22} aria-hidden="true" />
                <strong>No monitoring visits submitted yet</strong>
                <p>Monitoring history will appear here after an authorized Staff submission.</p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </ModalDialog>
  );
}
