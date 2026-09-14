import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  Sprout,
  ClipboardList,
  Clock3,
  SearchCheck,
  CircleCheckBig,
  CircleX,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  CalendarDays,
  MapPin,
  UserRound,
  Building2,
  Phone,
  Trees,
  FileText,
  Users,
  Clock,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import "../styles/my-requests.css";

const STORAGE_KEY = "menro_seedling_requests";
const BARANGAY_GEOJSON_URL = "/data/juban-barangays.geojson";
const PAGE_SIZE = 10;

function getStoredRequests() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to read seedling requests:", error);
    return [];
  }
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    const fallbackDate = new Date(value);
    if (Number.isNaN(fallbackDate.getTime())) return value;

    return fallbackDate.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "—";

  const [hours, minutes] = value.split(":");
  if (hours === undefined || minutes === undefined) return value;

  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRequestSeedlings(request) {
  if (Array.isArray(request?.trees)) return request.trees;
  if (Array.isArray(request?.seedlings)) return request.seedlings;
  if (Array.isArray(request?.seedlingItems)) return request.seedlingItems;
  return [];
}

function getTotalSeedlings(request) {
  const items = getRequestSeedlings(request);

  if (items.length > 0) {
    return items.reduce(
      (total, seedling) => total + Number(seedling?.quantity || 0),
      0
    );
  }

  if (request?.quantity) return Number(request.quantity);
  if (request?.totalSeedlings) return Number(request.totalSeedlings);
  return 0;
}

function getPurpose(request) {
  return (
    request?.purpose ||
    request?.purposeActivity ||
    request?.purposeDetails ||
    request?.activity ||
    "—"
  );
}

function getBarangay(request) {
  return (
    request?.barangay ||
    request?.plantingBarangay ||
    request?.eventBarangay ||
    "—"
  );
}

function getRequesterName(request) {
  return (
    request?.requesterName ||
    request?.fullName ||
    request?.applicant ||
    "—"
  );
}

function getPosition(request) {
  return (
    request?.position ||
    request?.requesterRole ||
    request?.positionRole ||
    "—"
  );
}

function getOrganization(request) {
  return request?.organization || "—";
}

function getContactNumber(request) {
  return request?.contactNumber || "—";
}

function getEventName(request) {
  return (
    request?.eventName ||
    request?.plantingEventName ||
    request?.proposedEventName ||
    "—"
  );
}

function getPlantingSite(request) {
  return (
    request?.plantingSiteName ||
    request?.plantingSite ||
    request?.siteName ||
    "—"
  );
}

function getEventLocation(request) {
  return (
    request?.eventLocation ||
    request?.plantingSiteLocation ||
    request?.location ||
    request?.plantingLocation ||
    "—"
  );
}

function getExpectedParticipants(request) {
  return request?.expectedParticipants || request?.participants || "—";
}

function getSubmittedDate(request) {
  return (
    request?.createdAt ||
    request?.requestDate ||
    request?.dateSubmitted ||
    request?.submittedAt ||
    ""
  );
}

function StatusBadge({ status }) {
  const normalizedStatus = status || "Pending Review";

  const classMap = {
    "Pending Review": "myr-status myr-status-pending",
    "Under Review": "myr-status myr-status-under-review",
    Reviewed: "myr-status myr-status-reviewed",
    Approved: "myr-status myr-status-approved",
    Rejected: "myr-status myr-status-rejected",
  };

  return (
    <span
      className={
        classMap[normalizedStatus] || "myr-status myr-status-pending"
      }
    >
      {normalizedStatus}
    </span>
  );
}


function MyRequestLocationPreview({ request }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const boundaryLayerRef = useRef(null);
  const siteLayerRef = useRef(null);
  const [mapError, setMapError] = useState("");

  const panMap = (x, y) => {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.panBy([x, y], {
      animate: true,
      duration: 0.2,
    });
  };

  const barangay = getBarangay(request);

  const rawLatitude = request?.plantingSiteLatitude;
  const rawLongitude = request?.plantingSiteLongitude;

  const hasValidSiteCoordinates =
    rawLatitude !== null &&
    rawLatitude !== undefined &&
    rawLatitude !== "" &&
    rawLongitude !== null &&
    rawLongitude !== undefined &&
    rawLongitude !== "" &&
    Number.isFinite(Number(rawLatitude)) &&
    Number.isFinite(Number(rawLongitude));

  const latitude = hasValidSiteCoordinates
    ? Number(rawLatitude)
    : null;

  const longitude = hasValidSiteCoordinates
    ? Number(rawLongitude)
    : null;

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      center: [12.82, 124.0],
      zoom: 12,
      minZoom: 10,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: true,
    });

    const mapTilerKey =
      import.meta.env.VITE_MAPTILER_API_KEY;

    if (mapTilerKey) {
      L.tileLayer(
        `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 20,
          crossOrigin: true,
          attribution:
            '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }
      ).addTo(map);
    } else {
      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }
      ).addTo(map);
    }

    mapRef.current = map;

    window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      map.remove();
      mapRef.current = null;
      boundaryLayerRef.current = null;
      siteLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      const map = mapRef.current;

      if (!map) {
        return;
      }

      setMapError("");

      if (boundaryLayerRef.current) {
        map.removeLayer(boundaryLayerRef.current);
        boundaryLayerRef.current = null;
      }

      if (siteLayerRef.current) {
        map.removeLayer(siteLayerRef.current);
        siteLayerRef.current = null;
      }

      let jubanBounds = null;
      let selectedBarangayBounds = null;

      try {
        const response = await fetch(
          BARANGAY_GEOJSON_URL
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load barangay boundaries (${response.status}).`
          );
        }

        const geoJson = await response.json();

        if (cancelled || !mapRef.current) {
          return;
        }

        const normalizeName = (value) =>
          String(value || "")
            .trim()
            .toLowerCase();

        const getFeatureBarangayName = (feature) =>
          feature?.properties?.brgy_name ||
          feature?.properties?.barangay ||
          feature?.properties?.name ||
          feature?.properties?.NAME ||
          "";

        const selectedBarangay =
          normalizeName(barangay);

        const boundaryLayer = L.geoJSON(
          geoJson,
          {
            style: (feature) => {
              const featureBarangay =
                normalizeName(
                  getFeatureBarangayName(feature)
                );

              const isSelected =
                selectedBarangay &&
                featureBarangay === selectedBarangay;

              return {
                color: isSelected
                  ? "#087443"
                  : "#48725c",
                weight: isSelected ? 3 : 1.4,
                opacity: 1,
                fillColor: isSelected
                  ? "#76c893"
                  : "#dff2e5",
                fillOpacity: isSelected
                  ? 0.32
                  : 0.12,
              };
            },
            interactive: false,
            onEachFeature: (feature, layer) => {
              const featureBarangay =
                getFeatureBarangayName(feature);

              if (featureBarangay) {
                layer.bindTooltip(
                  String(featureBarangay),
                  {
                    permanent: true,
                    direction: "center",
                    className:
                      "myr-barangay-label-plain",
                    interactive: false,
                    opacity: 1,
                  }
                );
              }

              const isSelected =
                selectedBarangay &&
                normalizeName(featureBarangay) ===
                  selectedBarangay;

              if (
                isSelected &&
                typeof layer.getBounds === "function"
              ) {
                const bounds = layer.getBounds();

                if (bounds.isValid()) {
                  selectedBarangayBounds =
                    selectedBarangayBounds
                      ? selectedBarangayBounds.extend(
                          bounds
                        )
                      : L.latLngBounds(bounds);
                }
              }
            },
          }
        ).addTo(map);

        boundaryLayerRef.current =
          boundaryLayer;

        const bounds =
          boundaryLayer.getBounds();

        if (bounds.isValid()) {
          jubanBounds = bounds;
        }
      } catch (error) {
        console.error(
          "Unable to load request location preview:",
          error
        );

        setMapError(
          "Location preview is unavailable."
        );
      }

      if (
        hasValidSiteCoordinates &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      ) {
        const group =
          L.layerGroup().addTo(map);

        L.circleMarker(
          [latitude, longitude],
          {
            radius: 8,
            color: "#ffffff",
            weight: 3,
            fillColor: "#087443",
            fillOpacity: 1,
          }
        )
          .bindTooltip(
            getPlantingSite(request),
            {
              permanent: false,
              direction: "top",
            }
          )
          .addTo(group);

        siteLayerRef.current = group;

        map.setView(
          [latitude, longitude],
          16,
          { animate: false }
        );
      } else if (
        selectedBarangayBounds?.isValid()
      ) {
        map.fitBounds(
          selectedBarangayBounds,
          {
            padding: [28, 28],
            maxZoom: 14,
            animate: false,
          }
        );
      } else if (jubanBounds?.isValid()) {
        map.fitBounds(
          jubanBounds.pad(0.05),
          {
            padding: [18, 18],
            maxZoom: 12,
            animate: false,
          }
        );
      }

      window.setTimeout(() => {
        map.invalidateSize();
      }, 0);
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [
    barangay,
    latitude,
    longitude,
    hasValidSiteCoordinates,
    request,
  ]);

  return (
    <div
      className="myr-location-preview"
      style={{
        position: "relative",
        width: "100%",
        minHeight: "300px",
        border: "1px solid #dfe8e2",
        borderRadius: "10px",
        overflow: "hidden",
        background: "#f7faf8",
      }}
    >
      <style>{`
        .myr-barangay-label-plain {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #263a2f !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          padding: 0 !important;
          white-space: nowrap !important;
        }

        .myr-barangay-label-plain::before {
          display: none !important;
        }
      `}</style>

      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "300px",
        }}
      />

      <div
        className="myr-map-pan-controls"
        style={{
          position: "absolute",
          right: "12px",
          bottom: "12px",
          zIndex: 500,
          display: "grid",
          gridTemplateColumns: "34px 34px 34px",
          gridTemplateRows: "34px 34px 34px",
          gap: "4px",
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          aria-label="Move map up"
          title="Move map up"
          onClick={() => panMap(0, -120)}
          style={{
            gridColumn: "2",
            gridRow: "1",
            width: "34px",
            height: "34px",
            display: "grid",
            placeItems: "center",
            border: "1px solid #cfdad3",
            borderRadius: "7px",
            background: "rgba(255, 255, 255, 0.96)",
            color: "#2f4638",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
          }}
        >
          <ChevronUp size={18} />
        </button>

        <button
          type="button"
          aria-label="Move map left"
          title="Move map left"
          onClick={() => panMap(-120, 0)}
          style={{
            gridColumn: "1",
            gridRow: "2",
            width: "34px",
            height: "34px",
            display: "grid",
            placeItems: "center",
            border: "1px solid #cfdad3",
            borderRadius: "7px",
            background: "rgba(255, 255, 255, 0.96)",
            color: "#2f4638",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
          }}
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          aria-label="Move map right"
          title="Move map right"
          onClick={() => panMap(120, 0)}
          style={{
            gridColumn: "3",
            gridRow: "2",
            width: "34px",
            height: "34px",
            display: "grid",
            placeItems: "center",
            border: "1px solid #cfdad3",
            borderRadius: "7px",
            background: "rgba(255, 255, 255, 0.96)",
            color: "#2f4638",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
          }}
        >
          <ChevronRight size={18} />
        </button>

        <button
          type="button"
          aria-label="Move map down"
          title="Move map down"
          onClick={() => panMap(0, 120)}
          style={{
            gridColumn: "2",
            gridRow: "3",
            width: "34px",
            height: "34px",
            display: "grid",
            placeItems: "center",
            border: "1px solid #cfdad3",
            borderRadius: "7px",
            background: "rgba(255, 255, 255, 0.96)",
            color: "#2f4638",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
          }}
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {mapError && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 500,
            padding: "8px 10px",
            borderRadius: "8px",
            background:
              "rgba(255, 255, 255, 0.96)",
            border: "1px solid #ead8d8",
            color: "#9d3434",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {mapError}
        </div>
      )}
    </div>
  );
}

export default function MyRequestsPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const loadRequests = () => {
      setRequests(getStoredRequests());
    };

    loadRequests();
    window.addEventListener("storage", loadRequests);

    return () => {
      window.removeEventListener("storage", loadRequests);
    };
  }, []);

  const participantId =
    currentUser?.uid || currentUser?.id || currentUser?.email || "";

  const participantRequests = useMemo(() => {
    if (!participantId) return [];

    return requests
      .filter((request) => {
        return (
          request?.participantId === participantId ||
          request?.createdByUid === participantId ||
          request?.userId === participantId
        );
      })
      .sort((a, b) => {
        const dateA = new Date(getSubmittedDate(a) || 0).getTime();
        const dateB = new Date(getSubmittedDate(b) || 0).getTime();
        return dateB - dateA;
      });
  }, [requests, participantId]);

  const counts = useMemo(() => {
    return {
      total: participantRequests.length,
      pending: participantRequests.filter(
        (request) => request.status === "Pending Review"
      ).length,
      reviewed: participantRequests.filter(
        (request) => request.status === "Reviewed"
      ).length,
      approved: participantRequests.filter(
        (request) => request.status === "Approved"
      ).length,
      rejected: participantRequests.filter(
        (request) => request.status === "Rejected"
      ).length,
    };
  }, [participantRequests]);

  const totalPages = Math.max(
    1,
    Math.ceil(participantRequests.length / PAGE_SIZE)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRequests = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;

    return participantRequests.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );
  }, [participantRequests, safeCurrentPage]);

  const firstRecord =
    participantRequests.length === 0
      ? 0
      : (safeCurrentPage - 1) * PAGE_SIZE + 1;

  const lastRecord = Math.min(
    safeCurrentPage * PAGE_SIZE,
    participantRequests.length
  );

  const handleRequestSeedlings = () => {
    navigate("/participant/request-seedlings");
  };

  const handleViewRequest = (request) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  const handleCloseDetails = () => {
    setShowDetailsModal(false);
    setSelectedRequest(null);
  };

  return (
    <div className="myr-page">
      <div className="myr-page-header">
        <div className="myr-title-group">
          <div className="myr-title-icon">
            <Sprout size={24} />
          </div>

          <div>
            <h1>My Seedling Requests</h1>
            <p>
              Track the status and details of your seedling requests submitted
              to MENRO.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="myr-request-button"
          onClick={handleRequestSeedlings}
        >
          <Plus size={19} />
          <span>Request Seedlings</span>
        </button>
      </div>

      <div className="myr-summary-grid">
        <div className="myr-summary-card">
          <div className="myr-summary-icon myr-summary-icon-total">
            <ClipboardList size={24} />
          </div>
          <div>
            <span>Total Requests</span>
            <strong>{counts.total}</strong>
          </div>
        </div>

        <div className="myr-summary-card myr-summary-card-pending">
          <div className="myr-summary-icon myr-summary-icon-pending">
            <Clock3 size={25} />
          </div>
          <div>
            <span>Pending Review</span>
            <strong>{counts.pending}</strong>
          </div>
        </div>

        <div className="myr-summary-card myr-summary-card-reviewed">
          <div className="myr-summary-icon myr-summary-icon-reviewed">
            <SearchCheck size={25} />
          </div>
          <div>
            <span>Reviewed</span>
            <strong>{counts.reviewed}</strong>
          </div>
        </div>

        <div className="myr-summary-card myr-summary-card-approved">
          <div className="myr-summary-icon myr-summary-icon-approved">
            <CircleCheckBig size={25} />
          </div>
          <div>
            <span>Approved</span>
            <strong>{counts.approved}</strong>
          </div>
        </div>

        <div className="myr-summary-card myr-summary-card-rejected">
          <div className="myr-summary-icon myr-summary-icon-rejected">
            <CircleX size={25} />
          </div>
          <div>
            <span>Rejected</span>
            <strong>{counts.rejected}</strong>
          </div>
        </div>
      </div>

      <div className="myr-table-card">
        <div className="myr-table-wrapper">
          <table className="myr-table">
            <thead>
              <tr>
                <th className="myr-number-column">#</th>
                <th>Request ID</th>
                <th>Purpose / Activity</th>
                <th>Barangay</th>
                <th>Seedlings Requested</th>
                <th>Date Submitted</th>
                <th>Status</th>
                <th className="myr-action-column">Action</th>
              </tr>
            </thead>

            <tbody>
              {paginatedRequests.length > 0 ? (
                paginatedRequests.map((request, index) => (
                  <tr key={request.id || index}>
                    <td className="myr-row-number">
                      {(safeCurrentPage - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td>
                      <span className="myr-request-id">
                        {request.id || "—"}
                      </span>
                    </td>
                    <td>
                      <span className="myr-purpose-text">
                        {getPurpose(request)}
                      </span>
                    </td>
                    <td>{getBarangay(request)}</td>
                    <td>
                      <span className="myr-seedling-count">
                        {getTotalSeedlings(request)}
                      </span>
                    </td>
                    <td>{formatDateTime(getSubmittedDate(request))}</td>
                    <td>
                      <StatusBadge status={request.status} />
                    </td>
                    <td className="myr-action-cell">
                      <button
                        type="button"
                        className="myr-view-button"
                        onClick={() => handleViewRequest(request)}
                        title="View request details"
                        aria-label={`View details of ${request.id || "request"}`}
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="myr-empty-cell">
                    <div className="myr-empty-state">
                      <div className="myr-empty-illustration">
                        <ClipboardList size={56} />
                        <span className="myr-empty-sprout">
                          <Sprout size={34} />
                        </span>
                      </div>

                      <h2>No seedling requests yet</h2>
                      <p>
                        You haven't submitted any seedling requests. Click the
                        "Request Seedlings" button above to create your first
                        request.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="myr-pagination">
          <div className="myr-pagination-info">
            Showing {firstRecord} to {lastRecord} of{" "}
            {participantRequests.length} requests
          </div>

          <div className="myr-pagination-actions">
            <button
              type="button"
              className="myr-page-arrow"
              disabled={
                safeCurrentPage === 1 || participantRequests.length === 0
              }
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              aria-label="Previous page"
            >
              <ChevronLeft size={19} />
            </button>

            <div className="myr-current-page">{safeCurrentPage}</div>

            <button
              type="button"
              className="myr-page-arrow"
              disabled={
                safeCurrentPage === totalPages ||
                participantRequests.length === 0
              }
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              aria-label="Next page"
            >
              <ChevronRight size={19} />
            </button>

            <div className="myr-page-size">{PAGE_SIZE} / page</div>
          </div>
        </div>
      </div>

      {showDetailsModal && selectedRequest && (
        <div
          className="myr-modal-overlay"
          onMouseDown={handleCloseDetails}
        >
          <div
            className="myr-details-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="myr-details-title"
          >
            <div className="myr-modal-header">
              <div>
                <span className="myr-modal-label">Seedling Request</span>
                <h2 id="myr-details-title">Request Details</h2>
                <p>{selectedRequest.id || "Seedling Request"}</p>
              </div>

              <button
                type="button"
                className="myr-modal-close"
                onClick={handleCloseDetails}
                aria-label="Close request details"
              >
                <X size={21} />
              </button>
            </div>

            <div className="myr-modal-content">
              <div className="myr-details-status-row">
                <div>
                  <span>Current Status</span>
                  <StatusBadge status={selectedRequest.status} />
                </div>

                <div>
                  <span>Date Submitted</span>
                  <strong>
                    {formatDateTime(getSubmittedDate(selectedRequest))}
                  </strong>
                </div>
              </div>

              <section className="myr-detail-section">
                <div className="myr-section-title">
                  <UserRound size={18} />
                  <div>
                    <h3>Requester Information</h3>
                    <p>Information submitted with this request.</p>
                  </div>
                </div>

                <div className="myr-form-grid">
                  <div className="myr-readonly-field">
                    <label>Requester Name</label>
                    <div>
                      <UserRound size={16} />
                      <span>{getRequesterName(selectedRequest)}</span>
                    </div>
                  </div>

                  <div className="myr-readonly-field">
                    <label>Position / Role</label>
                    <div>
                      <UserRound size={16} />
                      <span>{getPosition(selectedRequest)}</span>
                    </div>
                  </div>

                  <div className="myr-readonly-field">
                    <label>Organization</label>
                    <div>
                      <Building2 size={16} />
                      <span>{getOrganization(selectedRequest)}</span>
                    </div>
                  </div>

                  <div className="myr-readonly-field">
                    <label>Contact Number</label>
                    <div>
                      <Phone size={16} />
                      <span>{getContactNumber(selectedRequest)}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="myr-detail-section">
                <div className="myr-section-title">
                  <Trees size={18} />
                  <div>
                    <h3>Seedlings Requested</h3>
                    <p>Requested tree species and quantity.</p>
                  </div>
                </div>

                <div className="myr-seedling-list">
                  {getRequestSeedlings(selectedRequest).length > 0 ? (
                    getRequestSeedlings(selectedRequest).map(
                      (seedling, index) => (
                        <div
                          className="myr-seedling-item"
                          key={`${
                            seedling.treeName ||
                            seedling.name ||
                            seedling.species ||
                            "seedling"
                          }-${index}`}
                        >
                          <div>
                            <span>Tree Name</span>
                            <strong>
                              {seedling.treeName ||
                                seedling.name ||
                                seedling.species ||
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span>Quantity</span>
                            <strong>{Number(seedling.quantity || 0)}</strong>
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <div className="myr-seedling-item">
                      <div>
                        <span>Tree Name</span>
                        <strong>
                          {selectedRequest.species ||
                            selectedRequest.treeName ||
                            "—"}
                        </strong>
                      </div>
                      <div>
                        <span>Quantity</span>
                        <strong>{getTotalSeedlings(selectedRequest)}</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="myr-total-seedlings">
                  <span>Total Seedlings</span>
                  <strong>{getTotalSeedlings(selectedRequest)}</strong>
                </div>
              </section>

              <section className="myr-detail-section">
                <div className="myr-section-title">
                  <FileText size={18} />
                  <div>
                    <h3>Request Details</h3>
                    <p>Purpose and preferred release schedule.</p>
                  </div>
                </div>

                <div className="myr-form-grid">
                  <div className="myr-readonly-field myr-field-full">
                    <label>Purpose / Activity</label>
                    <div>
                      <FileText size={16} />
                      <span>{getPurpose(selectedRequest)}</span>
                    </div>
                  </div>

                  <div className="myr-readonly-field">
                    <label>Preferred Release Date</label>
                    <div>
                      <CalendarDays size={16} />
                      <span>
                        {formatDate(selectedRequest.preferredReleaseDate)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="myr-detail-section">
                <div className="myr-section-title">
                  <CalendarDays size={18} />
                  <div>
                    <h3>Proposed Planting Event</h3>
                    <p>
                      Planting activity information included in the request.
                    </p>
                  </div>
                </div>

                <div className="myr-form-grid">
                  <div className="myr-readonly-field myr-field-full">
                    <label>Event Name</label>
                    <div>
                      <CalendarDays size={16} />
                      <span>{getEventName(selectedRequest)}</span>
                    </div>
                  </div>

                  <div className="myr-readonly-field">
                    <label>Barangay</label>
                    <div>
                      <MapPin size={16} />
                      <span>{getBarangay(selectedRequest)}</span>
                    </div>
                  </div>

                  <div className="myr-readonly-field">
                    <label>Planting Site</label>
                    <div>
                      <MapPin size={16} />
                      <span>{getPlantingSite(selectedRequest)}</span>
                    </div>
                  </div>

                  <div className="myr-readonly-field">
                    <label>Proposed Date</label>
                    <div>
                      <CalendarDays size={16} />
                      <span>
                        {formatDate(
                          selectedRequest.proposedDate ||
                            selectedRequest.eventDate
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="myr-readonly-field">
                    <label>Expected Participants</label>
                    <div>
                      <Users size={16} />
                      <span>{getExpectedParticipants(selectedRequest)}</span>
                    </div>
                  </div>

                  <div className="myr-readonly-field">
                    <label>Start Time</label>
                    <div>
                      <Clock size={16} />
                      <span>{formatTime(selectedRequest.startTime)}</span>
                    </div>
                  </div>

                  <div className="myr-readonly-field">
                    <label>End Time</label>
                    <div>
                      <Clock size={16} />
                      <span>{formatTime(selectedRequest.endTime)}</span>
                    </div>
                  </div>

                  <div className="myr-readonly-field myr-field-full">
                    <label>Event Location</label>
                    <div>
                      <MapPin size={16} />
                      <span>{getEventLocation(selectedRequest)}</span>
                    </div>
                  </div>

                  <div
                    className="myr-field-full"
                    style={{
                      gridColumn: "1 / -1",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#34463c",
                      }}
                    >
                      Location Preview
                    </label>

                    <MyRequestLocationPreview
                      request={selectedRequest}
                    />
                  </div>

                  <div className="myr-readonly-field myr-field-full">
                    <label>Event Description</label>
                    <div className="myr-readonly-textarea">
                      <span>
                        {selectedRequest.eventDescription ||
                          selectedRequest.description ||
                          "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {(selectedRequest.reviewRemarks || selectedRequest.remarks) && (
                <section className="myr-detail-section">
                  <div className="myr-section-title">
                    <FileText size={18} />
                    <div>
                      <h3>MENRO Remarks</h3>
                      <p>Review notes related to this request.</p>
                    </div>
                  </div>

                  <div className="myr-remarks-box">
                    {selectedRequest.reviewRemarks || selectedRequest.remarks}
                  </div>
                </section>
              )}
            </div>

            <div className="myr-modal-footer">
              <button
                type="button"
                className="myr-close-button"
                onClick={handleCloseDetails}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
