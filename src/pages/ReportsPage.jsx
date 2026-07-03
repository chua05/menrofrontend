import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FiFileText, FiDownload, FiFilter } from "react-icons/fi";

const REPORT_TYPES = [
  { id: "seedling-distribution", label: "Seedling Distribution Report", icon: "🌱", description: "Summary of all seedling distributions and requests." },
  { id: "planting-activity", label: "Planting Activity Report", icon: "🌳", description: "Summary of all planting activities and events." },
  { id: "tree-monitoring", label: "Tree Monitoring Report", icon: "📊", description: "Tree survival rates and condition updates." },
  { id: "participant", label: "Participant Report", icon: "👥", description: "List of registered participants and their activities." },
  { id: "monthly", label: "Monthly Report", icon: "📅", description: "Monthly summary of all environmental activities." },
  { id: "annual", label: "Annual Report", icon: "📋", description: "Annual summary of reforestation program implementation." },
];

const SAMPLE_REPORTS = [
  { id: "RPT-001", type: "Seedling Distribution Report", date: "2026-07-01", generatedBy: "Maria Santos", status: "Generated" },
  { id: "RPT-002", type: "Tree Monitoring Report", date: "2026-06-28", generatedBy: "Juan Dela Cruz", status: "Generated" },
  { id: "RPT-003", type: "Monthly Report", date: "2026-06-01", generatedBy: "Maria Santos", status: "Generated" },
];

export default function ReportsPage() {
  const { userRole, currentUser } = useAuth();
  const [reports, setReports] = useState(SAMPLE_REPORTS);
  const [selectedType, setSelectedType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleGenerate = () => {
    if (!selectedType) return;

    const newReport = {
      id: `RPT-00${reports.length + 1}`,
      type: REPORT_TYPES.find(r => r.id === selectedType)?.label || selectedType,
      date: new Date().toISOString().split("T")[0],
      generatedBy: currentUser?.fullName || "Current User",
      status: "Generated",
    };

    setReports((prev) => [newReport, ...prev]);
    setSuccessMsg("Report generated successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div style={{ padding: "32px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
          Reports
        </h1>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          Generate and download environmental monitoring reports.
        </p>
      </div>

      {/* Success message */}
      {successMsg && (
        <div style={{
          background: "#dcfce7", color: "#166534",
          padding: "12px 16px", borderRadius: "8px",
          marginBottom: "16px", fontSize: "13px", fontWeight: "500"
        }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Generate Report Section */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: "12px", padding: "24px",
        marginBottom: "24px"
      }}>
        <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a", marginBottom: "16px" }}>
          Generate New Report
        </h2>

        {/* Report Type Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "12px", marginBottom: "20px"
        }}>
          {REPORT_TYPES.map((type) => (
            <div
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              style={{
                border: `2px solid ${selectedType === type.id ? "#16a34a" : "#e5e7eb"}`,
                borderRadius: "10px", padding: "14px",
                cursor: "pointer",
                background: selectedType === type.id ? "#f0fdf4" : "#fff",
                transition: "all 0.2s"
              }}
            >
              <div style={{ fontSize: "22px", marginBottom: "6px" }}>{type.icon}</div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a1a1a", marginBottom: "4px" }}>
                {type.label}
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                {type.description}
              </div>
            </div>
          ))}
        </div>

        {/* Date Range Filter */}
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                padding: "10px 12px",
                border: "1px solid #e5e7eb", borderRadius: "8px",
                fontSize: "13px"
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                padding: "10px 12px",
                border: "1px solid #e5e7eb", borderRadius: "8px",
                fontSize: "13px"
              }}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={!selectedType}
            style={{
              padding: "10px 20px",
              background: selectedType ? "#16a34a" : "#e5e7eb",
              color: selectedType ? "#fff" : "#9ca3af",
              border: "none", borderRadius: "8px",
              fontSize: "13px", fontWeight: "600",
              cursor: selectedType ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: "6px"
            }}
          >
            <FiFileText size={14} /> Generate Report
          </button>
        </div>
      </div>

      {/* Generated Reports Table */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: "12px", overflow: "hidden"
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a" }}>
            Generated Reports
          </h2>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Report ID", "Type", "Date Generated", "Generated By", "Status", "Actions"].map((h) => (
                <th key={h} style={{
                  padding: "12px 16px", textAlign: "left",
                  fontSize: "12px", fontWeight: "600",
                  color: "#6b7280", textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => (
              <tr key={r.id} style={{
                borderTop: "1px solid #f3f4f6",
                background: i % 2 === 0 ? "#fff" : "#fafafa"
              }}>
                <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>
                  {r.id}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {r.type}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {r.date}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {r.generatedBy}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: "999px",
                    fontSize: "12px", fontWeight: "600",
                    background: "#dcfce7", color: "#166534"
                  }}>
                    {r.status}
                  </span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <button
                    style={{
                      padding: "6px 12px",
                      background: "#dbeafe", color: "#1e40af",
                      border: "none", borderRadius: "6px",
                      fontSize: "12px", fontWeight: "600",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "4px"
                    }}
                  >
                    <FiDownload size={11} /> Download PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {reports.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
            No reports generated yet.
          </div>
        )}
      </div>
    </div>
  );
}