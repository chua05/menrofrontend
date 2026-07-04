import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FiEye, FiCheckSquare } from "react-icons/fi";

const SAMPLE_REQUESTS = [
  {
    id: "REQ-001",
    applicant: "Juan Dela Cruz",
    barangay: "Barangay Tughan",
    species: "Narra",
    quantity: 10,
    purpose: "Reforestation of barangay hillside area",
    organization: "Barangay Tughan",
    date: "2026-07-01",
    status: "Pending",
    remarks: "",
  },
  {
    id: "REQ-002",
    applicant: "Maria Santos",
    barangay: "Barangay Bulan Shore",
    species: "Mahogany",
    quantity: 5,
    purpose: "School greening program",
    organization: "Juban Central School",
    date: "2026-07-02",
    status: "Pending",
    remarks: "",
  },
  {
    id: "REQ-003",
    applicant: "Pedro Reyes",
    barangay: "Barangay Gatbo",
    species: "Bamboo",
    quantity: 20,
    purpose: "Erosion control along riverbank",
    organization: "Barangay Gatbo",
    date: "2026-07-03",
    status: "Reviewed",
    remarks: "Information verified. Ready for admin approval.",
  },
];

const STATUS_COLORS = {
  "Pending": { bg: "#fef9c3", color: "#854d0e" },
  "Reviewed": { bg: "#dbeafe", color: "#1e40af" },
  "Approved": { bg: "#dcfce7", color: "#166534" },
  "Rejected": { bg: "#fee2e2", color: "#991b1b" },
  "Released": { bg: "#f3e8ff", color: "#6b21a8" },
};

export default function ProcessRequestsPage() {
  const { userRole } = useAuth();
  const [requests, setRequests] = useState(SAMPLE_REQUESTS);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleMarkReviewed = (e) => {
    e.preventDefault();
    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedRequest.id
          ? { ...r, status: "Reviewed", remarks: remarks || "Verified by staff." }
          : r
      )
    );
    setShowReviewModal(false);
    setRemarks("");
    setSuccessMsg("Request marked as Reviewed!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleApprove = (id) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "Approved", remarks: "Approved by admin." } : r
      )
    );
    setSuccessMsg("Request approved!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleReject = (id) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "Rejected", remarks: "Rejected by admin." } : r
      )
    );
    setSuccessMsg("Request rejected.");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div style={{ padding: "32px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
          Process Seedling Requests
        </h1>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          {userRole === "staff"
            ? "Review and verify submitted seedling requests before forwarding to Admin."
            : "Approve or reject reviewed seedling requests."}
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
          { label: "Total", value: requests.length, icon: "📋" },
          { label: "Pending", value: requests.filter(r => r.status === "Pending").length, icon: "⏳" },
          { label: "Reviewed", value: requests.filter(r => r.status === "Reviewed").length, icon: "🔍" },
          { label: "Approved", value: requests.filter(r => r.status === "Approved").length, icon: "✅" },
          { label: "Rejected", value: requests.filter(r => r.status === "Rejected").length, icon: "❌" },
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

      {/* Requests Table */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: "12px", overflow: "hidden"
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a" }}>
            All Requests
          </h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["ID", "Applicant", "Barangay", "Species", "Qty", "Date", "Status", "Actions"].map((h) => (
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
            {requests.map((r, i) => (
              <tr key={r.id} style={{
                borderTop: "1px solid #f3f4f6",
                background: i % 2 === 0 ? "#fff" : "#fafafa"
              }}>
                <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{r.id}</td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>{r.applicant}</td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>{r.barangay}</td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>{r.species}</td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151", fontWeight: "600" }}>{r.quantity}</td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>{r.date}</td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: "999px",
                    fontSize: "12px", fontWeight: "600",
                    background: STATUS_COLORS[r.status]?.bg,
                    color: STATUS_COLORS[r.status]?.color,
                  }}>{r.status}</span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => { setSelectedRequest(r); setShowViewModal(true); }}
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

                    {/* Staff — Mark as Reviewed */}
                    {userRole === "staff" && r.status === "Pending" && (
                      <button
                        onClick={() => { setSelectedRequest(r); setShowReviewModal(true); }}
                        style={{
                          padding: "6px 10px",
                          background: "#dbeafe", color: "#1e40af",
                          border: "none", borderRadius: "6px",
                          fontSize: "12px", fontWeight: "600",
                          cursor: "pointer",
                          display: "flex", alignItems: "center", gap: "4px"
                        }}
                      >
                        <FiCheckSquare size={11} /> Review
                      </button>
                    )}

                    {/* Admin — Approve/Reject */}
                    {userRole === "admin" && r.status === "Reviewed" && (
                      <>
                        <button
                          onClick={() => handleApprove(r.id)}
                          style={{
                            padding: "6px 10px",
                            background: "#dcfce7", color: "#166534",
                            border: "none", borderRadius: "6px",
                            fontSize: "12px", fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >Approve</button>
                        <button
                          onClick={() => handleReject(r.id)}
                          style={{
                            padding: "6px 10px",
                            background: "#fee2e2", color: "#991b1b",
                            border: "none", borderRadius: "6px",
                            fontSize: "12px", fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >Reject</button>
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
      {showViewModal && selectedRequest && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "#fff", borderRadius: "16px",
            padding: "28px", width: "460px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0 }}>Request Details</h2>
              <span style={{
                padding: "4px 10px", borderRadius: "999px",
                fontSize: "11px", fontWeight: "600",
                background: STATUS_COLORS[selectedRequest.status]?.bg,
                color: STATUS_COLORS[selectedRequest.status]?.color,
              }}>{selectedRequest.status}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { label: "Request ID", value: selectedRequest.id },
                { label: "Applicant", value: selectedRequest.applicant },
                { label: "Barangay", value: selectedRequest.barangay },
                { label: "Organization", value: selectedRequest.organization },
                { label: "Species", value: selectedRequest.species },
                { label: "Quantity", value: selectedRequest.quantity },
                { label: "Purpose", value: selectedRequest.purpose },
                { label: "Date", value: selectedRequest.date },
                { label: "Remarks", value: selectedRequest.remarks || "—" },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", marginBottom: "2px" }}>
                    {item.label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: "14px", color: "#374151" }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowViewModal(false)}
                style={{ padding: "10px 18px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", background: "#fff", cursor: "pointer" }}
              >Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal — Staff only */}
      {showReviewModal && selectedRequest && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "#fff", borderRadius: "16px",
            padding: "28px", width: "420px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)"
          }}>
            <h2 style={{ fontSize: "17px", fontWeight: "700", marginBottom: "6px" }}>
              Mark as Reviewed
            </h2>
            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "20px" }}>
              {selectedRequest.applicant} — {selectedRequest.species} ({selectedRequest.quantity} pcs)
            </p>
            <form onSubmit={handleMarkReviewed}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                  Verification Remarks
                </label>
                <textarea
                  placeholder="Add verification notes..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 12px",
                    border: "1px solid #e5e7eb", borderRadius: "8px",
                    fontSize: "13px", resize: "vertical",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowReviewModal(false)}
                  style={{ padding: "10px 18px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", background: "#fff", cursor: "pointer" }}
                >Cancel</button>
                <button type="submit"
                  style={{ padding: "10px 18px", background: "#1e40af", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                >Mark as Reviewed</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}