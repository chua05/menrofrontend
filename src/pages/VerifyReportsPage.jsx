import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FiEye, FiCheckSquare, FiXSquare, FiMapPin, FiAlertTriangle } from "react-icons/fi";

const SAMPLE_REPORTS = [
  {
    id: "RPT-001",
    participant: "Juan Dela Cruz",
    barangay: "Barangay Tughan",
    site: "Tughan Reforestation Area",
    species: "Narra",
    quantity: 10,
    date: "2026-07-01",
    timestamp: "2026-07-01 08:23 AM",
    gps: "12.3456, 124.5678",
    photo: null,
    verificationStatus: "Pending",
    aiFlag: "Valid",
    remarks: "",
  },
  {
    id: "RPT-002",
    participant: "Maria Santos",
    barangay: "Barangay Bulan Shore",
    site: "Coastal Mangrove Zone",
    species: "Mangrove",
    quantity: 25,
    date: "2026-07-02",
    timestamp: "2026-07-02 07:45 AM",
    gps: "12.3478, 124.5690",
    photo: null,
    verificationStatus: "Pending",
    aiFlag: "Suspicious",
    remarks: "",
  },
  {
    id: "RPT-003",
    participant: "Pedro Reyes",
    barangay: "Juban Central School",
    site: "School Greening Zone",
    species: "Ipil-ipil",
    quantity: 15,
    date: "2026-06-10",
    timestamp: "2026-06-10 09:12 AM",
    gps: "12.3490, 124.5700",
    photo: null,
    verificationStatus: "Approved",
    aiFlag: "Valid",
    remarks: "Verified — GPS and timestamp matched.",
  },
];

const STATUS_COLORS = {
  "Pending": { bg: "#fef9c3", color: "#854d0e" },
  "Approved": { bg: "#dcfce7", color: "#166534" },
  "Rejected": { bg: "#fee2e2", color: "#991b1b" },
};

const FLAG_COLORS = {
  "Valid": { bg: "#dcfce7", color: "#166534" },
  "Suspicious": { bg: "#fee2e2", color: "#991b1b" },
};

export default function VerifyReportsPage() {
  const { userRole } = useAuth();
  const [reports, setReports] = useState(SAMPLE_REPORTS);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleApprove = (id) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, verificationStatus: "Approved", remarks: "Verified and approved." }
          : r
      )
    );
    setSuccessMsg("Report approved!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleReject = (id) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, verificationStatus: "Rejected", remarks: "Report rejected." }
          : r
      )
    );
    setSuccessMsg("Report rejected.");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div style={{ padding: "32px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
          Verify Planting Reports
        </h1>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          Review and verify geo-tagged planting reports submitted by participants.
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

      {/* Summary Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "16px", marginBottom: "24px"
      }}>
        {[
          { label: "Total Reports", value: reports.length, icon: "📄" },
          { label: "Pending", value: reports.filter(r => r.verificationStatus === "Pending").length, icon: "⏳" },
          { label: "Approved", value: reports.filter(r => r.verificationStatus === "Approved").length, icon: "✅" },
          { label: "Rejected", value: reports.filter(r => r.verificationStatus === "Rejected").length, icon: "❌" },
          { label: "Suspicious", value: reports.filter(r => r.aiFlag === "Suspicious").length, icon: "⚠️" },
        ].map((card) => (
          <div key={card.label} style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "12px", padding: "16px",
          }}>
            <div style={{ fontSize: "20px", marginBottom: "6px" }}>{card.icon}</div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a" }}>{card.value}</div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Suspicious Alert */}
      {reports.filter(r => r.aiFlag === "Suspicious").length > 0 && (
        <div style={{
          background: "#fef9c3", border: "1px solid #fde047",
          borderRadius: "10px", padding: "14px 18px",
          marginBottom: "20px", display: "flex",
          alignItems: "center", gap: "10px",
          fontSize: "13px", color: "#854d0e"
        }}>
          <FiAlertTriangle size={16} />
          <span>
            {reports.filter(r => r.aiFlag === "Suspicious").length} suspicious report(s) flagged for review.
          </span>
        </div>
      )}

      {/* Reports Table */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: "12px", overflow: "hidden"
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a" }}>
            Submitted Reports
          </h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["ID", "Participant", "Site", "Species", "Qty", "Date", "AI Flag", "Status", "Actions"].map((h) => (
                <th key={h} style={{
                  padding: "12px 16px", textAlign: "left",
                  fontSize: "12px", fontWeight: "600",
                  color: "#6b7280", textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => (
              <tr key={r.id} style={{
                borderTop: "1px solid #f3f4f6",
                background: i % 2 === 0 ? "#fff" : "#fafafa"
              }}>
                <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{r.id}</td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>{r.participant}</td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>{r.site}</td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>{r.species}</td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151", fontWeight: "600" }}>{r.quantity}</td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>{r.date}</td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: "999px",
                    fontSize: "12px", fontWeight: "600",
                    background: FLAG_COLORS[r.aiFlag]?.bg,
                    color: FLAG_COLORS[r.aiFlag]?.color,
                  }}>{r.aiFlag}</span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: "999px",
                    fontSize: "12px", fontWeight: "600",
                    background: STATUS_COLORS[r.verificationStatus]?.bg,
                    color: STATUS_COLORS[r.verificationStatus]?.color,
                  }}>{r.verificationStatus}</span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => { setSelectedReport(r); setShowViewModal(true); }}
                      style={{
                        padding: "6px 10px",
                        background: "#f3f4f6", color: "#374151",
                        border: "none", borderRadius: "6px",
                        fontSize: "12px", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "4px"
                      }}
                    >
                      <FiEye size={11} /> View
                    </button>
                    {r.verificationStatus === "Pending" && (
                      <>
                        <button
                          onClick={() => handleApprove(r.id)}
                          style={{
                            padding: "6px 10px",
                            background: "#dcfce7", color: "#166534",
                            border: "none", borderRadius: "6px",
                            fontSize: "12px", fontWeight: "600",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", gap: "4px"
                          }}
                        >
                          <FiCheckSquare size={11} /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(r.id)}
                          style={{
                            padding: "6px 10px",
                            background: "#fee2e2", color: "#991b1b",
                            border: "none", borderRadius: "6px",
                            fontSize: "12px", fontWeight: "600",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", gap: "4px"
                          }}
                        >
                          <FiXSquare size={11} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {showViewModal && selectedReport && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "#fff", borderRadius: "16px",
            padding: "28px", width: "480px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            maxHeight: "90vh", overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0 }}>Report Details</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{
                  padding: "4px 10px", borderRadius: "999px",
                  fontSize: "11px", fontWeight: "600",
                  background: FLAG_COLORS[selectedReport.aiFlag]?.bg,
                  color: FLAG_COLORS[selectedReport.aiFlag]?.color,
                }}>AI: {selectedReport.aiFlag}</span>
                <span style={{
                  padding: "4px 10px", borderRadius: "999px",
                  fontSize: "11px", fontWeight: "600",
                  background: STATUS_COLORS[selectedReport.verificationStatus]?.bg,
                  color: STATUS_COLORS[selectedReport.verificationStatus]?.color,
                }}>{selectedReport.verificationStatus}</span>
              </div>
            </div>

            {/* Verification checks */}
            <div style={{
              background: "#f9fafb", borderRadius: "10px",
              padding: "14px", marginBottom: "16px"
            }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", marginBottom: "10px" }}>
                AUTOMATED VERIFICATION CHECKS
              </div>
              {[
                { label: "GPS Coordinates", status: "✅ Valid" },
                { label: "Timestamp", status: "✅ Valid" },
                { label: "Duplicate Image", status: selectedReport.aiFlag === "Suspicious" ? "❌ Duplicate detected" : "✅ No duplicate" },
                { label: "Metadata", status: "✅ Complete" },
              ].map((check) => (
                <div key={check.label} style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: "13px", marginBottom: "6px"
                }}>
                  <span style={{ color: "#374151" }}>{check.label}</span>
                  <span style={{ fontWeight: "600" }}>{check.status}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { label: "Report ID", value: selectedReport.id },
                { label: "Participant", value: selectedReport.participant },
                { label: "Barangay", value: selectedReport.barangay },
                { label: "Site", value: selectedReport.site },
                { label: "Species", value: selectedReport.species },
                { label: "Quantity", value: selectedReport.quantity },
                { label: "Date", value: selectedReport.date },
                { label: "Timestamp", value: selectedReport.timestamp },
                { label: "GPS Coordinates", value: selectedReport.gps },
                { label: "Remarks", value: selectedReport.remarks || "—" },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", marginBottom: "2px" }}>
                    {item.label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: "14px", color: "#374151" }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "24px", display: "flex", justifyContent: "space-between" }}>
              {selectedReport.verificationStatus === "Pending" && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => { handleApprove(selectedReport.id); setShowViewModal(false); }}
                    style={{
                      padding: "10px 18px", background: "#16a34a",
                      color: "#fff", border: "none", borderRadius: "8px",
                      fontSize: "13px", fontWeight: "600", cursor: "pointer"
                    }}
                  >Approve</button>
                  <button
                    onClick={() => { handleReject(selectedReport.id); setShowViewModal(false); }}
                    style={{
                      padding: "10px 18px", background: "#fee2e2",
                      color: "#991b1b", border: "none", borderRadius: "8px",
                      fontSize: "13px", fontWeight: "600", cursor: "pointer"
                    }}
                  >Reject</button>
                </div>
              )}
              <button
                onClick={() => setShowViewModal(false)}
                style={{
                  padding: "10px 18px", border: "1px solid #e5e7eb",
                  borderRadius: "8px", fontSize: "13px",
                  background: "#fff", cursor: "pointer",
                  marginLeft: "auto"
                }}
              >Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}