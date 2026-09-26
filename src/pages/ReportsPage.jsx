import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase/config";
import { formatDisplayId } from "../utils/displayId";
import {
  FiBarChart2,
  FiCalendar,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiFileText,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiUsers,
  FiX,
  FiAlertCircle,
  FiPackage,
  FiMapPin,
} from "react-icons/fi";
import "../styles/reports.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const NO_REPORT_DATA_MESSAGE = "Report data is unavailable for the selected report type or filters.";

const REPORT_TYPES = [
  {
    id: "seedling-distribution",
    label: "Seedling Distribution Report",
    description:
      "Summary of seedling requests, releases, and distributions.",
    icon: FiPackage,
    iconClass: "seedling",
  },
  {
    id: "planting-activity",
    label: "Planting Activity Report",
    description:
      "Summary of planting activities, events, and planted trees.",
    icon: FiMapPin,
    iconClass: "planting",
  },
  {
    id: "tree-monitoring",
    label: "Tree Monitoring Report",
    description:
      "Summary of tree conditions, monitoring, and survival.",
    icon: FiBarChart2,
    iconClass: "monitoring",
  },
  {
    id: "participant",
    label: "Participant Report",
    description:
      "Summary of registered participants and their activities.",
    icon: FiUsers,
    iconClass: "participants",
  },
  {
    id: "monthly",
    label: "Monthly Report",
    description:
      "Summary of environmental activities for a selected month.",
    icon: FiCalendar,
    iconClass: "monthly",
  },
  {
    id: "annual",
    label: "Annual Report",
    description:
      "Annual summary of the reforestation program implementation.",
    icon: FiFileText,
    iconClass: "annual",
  },
];

function getReportTypeLabel(typeId) {
  return (
    REPORT_TYPES.find((type) => type.id === typeId)?.label ||
    typeId ||
    "Report"
  );
}

function formatDate(dateString) {
  if (!dateString) return "—";

  const timestampSeconds = dateString?._seconds ?? dateString?.seconds;
  const date = timestampSeconds !== undefined
    ? new Date(Number(timestampSeconds) * 1000)
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(dateString))
      ? `${dateString}T00:00:00` : dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ReportTypeIcon({ type }) {
  const Icon = type.icon;

  return (
    <div
      className={`report-type-icon report-type-icon-${type.iconClass}`}
      aria-hidden="true"
    >
      <Icon size={22} strokeWidth={1.9} />
    </div>
  );
}

export default function ReportsPage() {
  const { userRole } = useAuth();
  const [pageSearchParams] = useSearchParams();
  const appliedReportSearchRef = useRef("");
  const isAdminOrStaff = userRole === "admin" || userRole === "staff";

  const [reports, setReports] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [errorMsg, setErrorMsg] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const loadReports = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setHistoryLoading(true);
    setHistoryError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch(`${API_BASE_URL}/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Unable to load generated reports.");
      setReports(Array.isArray(payload?.data) ? payload.data : []);
    } catch (loadError) {
      setHistoryError(loadError.message || "Unable to load generated reports.");
    } finally {
      if (!silent) setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdminOrStaff) return undefined;
    const timer = window.setTimeout(() => void loadReports(), 0);
    return () => window.clearTimeout(timer);
  }, [isAdminOrStaff, loadReports]);

  useEffect(() => {
    const reportId = pageSearchParams.get("report") || "";
    if (!reportId || appliedReportSearchRef.current === reportId) return;
    const filterTimer = window.setTimeout(() => {
      appliedReportSearchRef.current = reportId;
      setSearchTerm(reportId);
      setCurrentPage(1);
    }, 0);
    return () => window.clearTimeout(filterTimer);
  }, [pageSearchParams]);

  const filteredReports = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesType =
        !filterType ||
        report.type === filterType;

      const matchesStatus =
        !filterStatus ||
        report.status === filterStatus;

      const matchesSearch =
        !search ||
        String(report.id).toLowerCase().includes(search) ||
        String(getReportTypeLabel(report.type)).toLowerCase().includes(search) ||
        String(report.generatedByName || report.generatedBy || "")
          .toLowerCase()
          .includes(search);

      return (
        matchesType &&
        matchesStatus &&
        matchesSearch
      );
    });
  }, [
    reports,
    filterType,
    filterStatus,
    searchTerm,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredReports.length / rowsPerPage
    )
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const paginatedReports = useMemo(() => {
    const start =
      (safeCurrentPage - 1) * rowsPerPage;

    return filteredReports.slice(
      start,
      start + rowsPerPage
    );
  }, [
    filteredReports,
    safeCurrentPage,
    rowsPerPage,
  ]);

  const clearFilters = () => {
    setFilterType("");
    setFilterStatus("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleDownload = async (report) => {
    setErrorMsg("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const path = report.downloadPath || `/api/reports/${encodeURIComponent(report.id)}/download`;
      const response = await fetch(
        path.startsWith("http") ? path : `${API_BASE_URL.replace(/\/api\/?$/, "")}${path}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to download report.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = report.fileName || `${report.reportNumber || report.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setErrorMsg(downloadError.message || "Failed to download report.");
    }
  };

  const handleGenerate = async () => {
    setErrorMsg("");

    if (!selectedType) {
      setErrorMsg("Please select a report type.");
      return;
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
      setErrorMsg(
        "Date From cannot be later than Date To."
      );
      return;
    }

    setGenerating(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch(`${API_BASE_URL}/reports`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: selectedType, dateFrom, dateTo }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Failed to generate report.");
      if (!payload?.data?.id || Number(payload.data.rowCount) < 1) {
        throw new Error(NO_REPORT_DATA_MESSAGE);
      }
      await loadReports({ silent: true });
      await handleDownload(payload.data);
    } catch (generateError) {
      setErrorMsg(generateError.message || "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  const showingFrom =
    filteredReports.length === 0
      ? 0
      : (safeCurrentPage - 1) * rowsPerPage + 1;

  const showingTo = Math.min(
    safeCurrentPage * rowsPerPage,
    filteredReports.length
  );

  return (
    <div className="reports-page">

      {/* =========================
          PAGE HEADER
      ========================= */}

      <div className="reports-header">
        <div className="reports-heading">
          <div className="reports-heading-icon">
            <FiFileText
              size={23}
              strokeWidth={1.9}
            />
          </div>

          <div>
            <h1>Reports</h1>

            <p>
              Generate and download environmental
              monitoring reports.
            </p>
          </div>
        </div>

        <div className="reports-header-note">
          <FiFileText size={14} />

          <span>
            Environmental Reports
          </span>
        </div>
      </div>

      {/* =========================
          GENERATE REPORT
      ========================= */}

      <section className="reports-card generate-report-card">

        <div className="reports-section-header">
          <div>
            <h2>
              Generate New Report
            </h2>

            <p>
              Select a report type and date range
              to generate a report from available
              system records.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="reports-alert reports-alert-error" role="alert">
            <div className="reports-alert-icon"><FiAlertCircle size={14} /></div>
            <div className="reports-alert-content">
              <strong>Unable to continue</strong>
              <span>{errorMsg}</span>
            </div>
            <button type="button" className="reports-alert-close"
              onClick={() => setErrorMsg("")} aria-label="Close error message">
              <FiX size={15} />
            </button>
          </div>
        )}

        {/* Report Type */}

        <div className="report-field-label">
          Report Type
        </div>

        <div className="report-type-grid">
          {REPORT_TYPES.map((type) => {
            const selected =
              selectedType === type.id;

            return (
              <button
                key={type.id}
                type="button"
                className={`report-type-card ${
                  selected
                    ? "selected"
                    : ""
                }`}
                onClick={() => {
                  setSelectedType(type.id);
                  setErrorMsg("");
                }}
              >
                <ReportTypeIcon
                  type={type}
                />

                <div className="report-type-content">
                  <strong>
                    {type.label}
                  </strong>

                  <span>
                    {type.description}
                  </span>
                </div>

                <span
                  className={`report-type-radio ${
                    selected
                      ? "checked"
                      : ""
                  }`}
                  aria-hidden="true"
                >
                  {selected && (
                    <span />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Date Parameters */}

        <div className="report-parameters">

          <div className="report-form-field">
            <label htmlFor="report-date-from">
              Date From
            </label>

            <div className="report-input-wrap">
              <input
                id="report-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setErrorMsg("");
                }}
              />

              <FiCalendar
                size={16}
              />
            </div>
          </div>

          <div className="report-form-field">
            <label htmlFor="report-date-to">
              Date To
            </label>

            <div className="report-input-wrap">
              <input
                id="report-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setErrorMsg("");
                }}
              />

              <FiCalendar
                size={16}
              />
            </div>
          </div>

          <button
            type="button"
            className="reports-primary-button generate-button"
            onClick={handleGenerate}
            disabled={!selectedType || !isAdminOrStaff || generating}
          >
            <FiFileText size={15} />
            {generating ? "Generating..." : "Generate Report"}
          </button>
        </div>

        {!isAdminOrStaff && (
          <div className="reports-permission-note">
            <FiUsers size={14} />

            <span>
              Report generation is available
              to authorized MENRO personnel.
            </span>
          </div>
        )}
      </section>

      {/* =========================
          GENERATED REPORTS
      ========================= */}

      <section className="reports-card generated-reports-card">

        <div className="generated-reports-header">

          <div>
            <h2>
              Generated Reports
            </h2>

            <p>
              View and download reports
              generated from system records.
            </p>
          </div>

          <button
            type="button"
            className={`reports-secondary-button ${
              filterOpen
                ? "active"
                : ""
            }`}
            onClick={() =>
              setFilterOpen(
                (previous) => !previous
              )
            }
          >
            <FiFilter size={14} />

            Filter
          </button>
        </div>

        {historyError && (
          <div className="reports-alert reports-alert-error" role="alert">
            <div className="reports-alert-icon"><FiAlertCircle size={14} /></div>
            <div className="reports-alert-content">
              <strong>Unable to load report history</strong>
              <span>{historyError}</span>
            </div>
            <button type="button" className="reports-alert-close"
              onClick={() => void loadReports()} aria-label="Retry loading reports">
              <FiRefreshCw size={15} />
            </button>
          </div>
        )}

        {/* Filter Panel */}

        {filterOpen && (
          <div className="reports-filter-panel">

            <div className="report-form-field">
              <label htmlFor="report-search">
                Search
              </label>

              <div className="report-input-wrap">
                <FiSearch
                  size={15}
                />

                <input
                  id="report-search"
                  type="text"
                  placeholder="Search report ID or type..."
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(
                      event.target.value
                    );
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            <div className="report-form-field">
              <label htmlFor="report-filter-type">
                Report Type
              </label>

              <div className="report-select-wrap">
                <select
                  id="report-filter-type"
                  value={filterType}
                  onChange={(event) => {
                    setFilterType(
                      event.target.value
                    );
                    setCurrentPage(1);
                  }}
                >
                  <option value="">
                    All Report Types
                  </option>

                  {REPORT_TYPES.map(
                    (type) => (
                      <option
                        key={type.id}
                        value={type.id}
                      >
                        {type.label}
                      </option>
                    )
                  )}
                </select>

                <FiChevronDown
                  size={15}
                />
              </div>
            </div>

            <div className="report-form-field">
              <label htmlFor="report-filter-status">
                Status
              </label>

              <div className="report-select-wrap">
                <select
                  id="report-filter-status"
                  value={filterStatus}
                  onChange={(event) => {
                    setFilterStatus(
                      event.target.value
                    );
                    setCurrentPage(1);
                  }}
                >
                  <option value="">
                    All Status
                  </option>

                  <option value="Generated">
                    Generated
                  </option>

                  <option value="Processing">
                    Processing
                  </option>

                  <option value="Failed">
                    Failed
                  </option>
                </select>

                <FiChevronDown
                  size={15}
                />
              </div>
            </div>

            <button
              type="button"
              className="reports-clear-button"
              onClick={clearFilters}
            >
              <FiRefreshCw
                size={14}
              />

              Clear
            </button>
          </div>
        )}

        {/* Table */}

        <div className="reports-table-wrap">
          <table className="reports-table">

            <thead>
              <tr>
                <th>#</th>
                <th>Report ID</th>
                <th>Type</th>
                <th>Date Generated</th>
                <th>Generated By</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedReports.map(
                (report, index) => (
                  <tr key={report.id}>

                    <td>
                      {
                        (safeCurrentPage -
                          1) *
                          rowsPerPage +
                          index +
                          1
                      }
                    </td>

                    <td>
                      <strong className="report-id">
                        {formatDisplayId("RPT", report.reportNumber, report.id)}
                      </strong>
                    </td>

                    <td>
                      {getReportTypeLabel(report.type)}
                    </td>

                    <td>
                      {formatDate(
                        report.generatedAt
                      )}
                    </td>

                    <td>
                      {report.generatedByName || report.generatedBy ||
                        "—"}
                    </td>

                    <td>
                      <span
                        className={`report-status report-status-${report.status
                          .toLowerCase()
                          .replace(
                            /\s+/g,
                            "-"
                          )}`}
                      >
                        <span />

                        {report.status}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="download-report-button"
                        onClick={() =>
                          handleDownload(
                            report
                          )
                        }
                      >
                        <FiDownload
                          size={13}
                        />

                        Download PDF
                      </button>
                    </td>

                  </tr>
                )
              )}
            </tbody>
          </table>

          {/* Empty State */}

          {!historyLoading && paginatedReports.length === 0 && (
            <div className="reports-empty-state">

              <div className="reports-empty-icon">
                <FiFileText
                  size={27}
                  strokeWidth={1.8}
                />
              </div>

              <h3>
                {reports.length === 0
                  ? "No generated reports available."
                  : "No reports found."}
              </h3>

              <p>
                {reports.length === 0
                  ? "No report has been generated from qualifying system records yet."
                  : "Try adjusting your filters or search term."}
              </p>

              {reports.length > 0 && (
                <button
                  type="button"
                  className="reports-empty-clear"
                  onClick={
                    clearFilters
                  }
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
          {historyLoading && (
            <div className="reports-empty-state" role="status">
              <div className="reports-empty-icon"><FiRefreshCw size={27} /></div>
              <h3>Loading generated reports...</h3>
            </div>
          )}
        </div>

        {/* Pagination */}

        <div className="reports-pagination">

          <span>
            Showing {showingFrom} to{" "}
            {showingTo} of{" "}
            {filteredReports.length}{" "}
            reports
          </span>

          <div className="pagination-controls">

            <button
              type="button"
              disabled={
                safeCurrentPage <= 1
              }
              onClick={() =>
                setCurrentPage(
                  (page) =>
                    Math.max(
                      1,
                      page - 1
                    )
                )
              }
              aria-label="Previous page"
            >
              <FiChevronLeft
                size={15}
              />
            </button>

            <span className="pagination-current">
              {safeCurrentPage}
            </span>

            <button
              type="button"
              disabled={
                safeCurrentPage >=
                totalPages
              }
              onClick={() =>
                setCurrentPage(
                  (page) =>
                    Math.min(
                      totalPages,
                      page + 1
                    )
                )
              }
              aria-label="Next page"
            >
              <FiChevronRight
                size={15}
              />
            </button>

            <div className="rows-per-page">
              <select
                value={rowsPerPage}
                onChange={(event) => {
                  setRowsPerPage(
                    Number(
                      event.target.value
                    )
                  );
                  setCurrentPage(1);
                }}
                aria-label="Rows per page"
              >
                <option value={10}>
                  10 / page
                </option>

                <option value={20}>
                  20 / page
                </option>

                <option value={50}>
                  50 / page
                </option>
              </select>

              <FiChevronDown
                size={13}
              />
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
