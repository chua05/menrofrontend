import { useState } from "react";
import { useAuth } from "../context/AuthContext";

// Sample data para sa testing
const SAMPLE_REQUESTS = [
  { id: "REQ-001", species: "Narra", quantity: 10, date: "2026-06-01", status: "Pending", remarks: "" },
  { id: "REQ-002", species: "Mahogany", quantity: 5, date: "2026-06-10", status: "Approved", remarks: "Ready for pickup" },
  { id: "REQ-003", species: "Bamboo", quantity: 20, date: "2026-06-15", status: "Reviewed", remarks: "For admin approval" },
];

const SEEDLING_TYPES = ["Narra", "Mahogany", "Bamboo", "Molave", "Ipil-ipil", "Acacia", "Teak", "Bagras"];

const STATUS_COLORS = {
  Pending: { bg: "#fef9c3", color: "#854d0e" },
  Reviewed: { bg: "#dbeafe", color: "#1e40af" },
  Approved: { bg: "#dcfce7", color: "#166534" },
  Rejected: { bg: "#fee2e2", color: "#991b1b" },
  Released: { bg: "#f3e8ff", color: "#6b21a8" },
};

export default function SeedlingRequestsPage() {
  const { userRole } = useAuth();
  const [requests, setRequests] = useState(SAMPLE_REQUESTS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    species: "",
    quantity: "",
    purpose: "",
    organization: "",
    preferredDate: "",
  });
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.species) e.species = "Required";
    if (!form.quantity || form.quantity < 1) e.quantity = "Enter a valid quantity";
    if (!form.purpose.trim()) e.purpose = "Required";
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});

    const newRequest = {
      id: `REQ-00${requests.length + 1}`,
      species: form.species,
      quantity: parseInt(form.quantity),
      date: new Date().toISOString().split("T")[0],
      status: "Pending",
      remarks: "",
    };

    setRequests((prev) => [newRequest, ...prev]);
    setForm({ species: "", quantity: "", purpose: "", organization: "", preferredDate: "" });
    setShowForm(false);
    setSuccessMsg("Request submitted successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div style={{ padding: "32px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
            {userRole === "volunteer" ? "Seedling Requests" : "Manage Seedling Requests"}
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            {userRole === "volunteer"
              ? "Submit and track your seedling requests."
              : "Review and process seedling requests."}
          </p>
        </div>
        {userRole === "volunteer" && (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              background: "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            {showForm ? "Cancel" : "+ New Request"}
          </button>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div style={{
          background: "#dcfce7",
          color: "#166534",
          padding: "12px 16px",
          borderRadius: "8px",
          marginBottom: "16px",
          fontSize: "13px",
          fontWeight: "500"
        }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Submit Form — Volunteer only */}
      {showForm && userRole === "volunteer" && (
        <div style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
        }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>
            New Seedling Request
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

              {/* Species */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", color: "#374151", display: "block", marginBottom: "6px" }}>
                  Tree Species *
                </label>
                <select
                  value={form.species}
                  onChange={update("species")}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1px solid ${errors.species ? "#f87171" : "#e5e7eb"}`,
                    borderRadius: "8px",
                    fontSize: "13px",
                    background: "#fff",
                    color: "#1a1a1a",
                  }}
                >
                  <option value="">Select species</option>
                  {SEEDLING_TYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {errors.species && <p style={{ color: "#f87171", fontSize: "11px", marginTop: "4px" }}>{errors.species}</p>}
              </div>

              {/* Quantity */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", color: "#374151", display: "block", marginBottom: "6px" }}>
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 10"
                  value={form.quantity}
                  onChange={update("quantity")}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1px solid ${errors.quantity ? "#f87171" : "#e5e7eb"}`,
                    borderRadius: "8px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.quantity && <p style={{ color: "#f87171", fontSize: "11px", marginTop: "4px" }}>{errors.quantity}</p>}
              </div>

              {/* Purpose */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "13px", fontWeight: "500", color: "#374151", display: "block", marginBottom: "6px" }}>
                  Purpose *
                </label>
                <textarea
                  placeholder="e.g. Reforestation of barangay hillside area"
                  value={form.purpose}
                  onChange={update("purpose")}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1px solid ${errors.purpose ? "#f87171" : "#e5e7eb"}`,
                    borderRadius: "8px",
                    fontSize: "13px",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
                {errors.purpose && <p style={{ color: "#f87171", fontSize: "11px", marginTop: "4px" }}>{errors.purpose}</p>}
              </div>

              {/* Organization */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", color: "#374151", display: "block", marginBottom: "6px" }}>
                  Organization (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Barangay Bulan"
                  value={form.organization}
                  onChange={update("organization")}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Preferred Date */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", color: "#374151", display: "block", marginBottom: "6px" }}>
                  Preferred Release Date (optional)
                </label>
                <input
                  type="date"
                  value={form.preferredDate}
                  onChange={update("preferredDate")}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  padding: "10px 18px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "13px",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: "10px 18px",
                  background: "#16a34a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests Table */}
      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a" }}>
            {userRole === "volunteer" ? "My Requests" : "All Requests"}
          </h2>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Request ID", "Species", "Quantity", "Date", "Status", "Remarks"].map((h) => (
                <th key={h} style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>
                  {h}
                </th>
              ))}
              {(userRole === "staff" || userRole === "admin") && (
                <th style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#6b7280",
                  textTransform: "uppercase",
                }}>
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {requests.map((req, i) => (
              <tr key={req.id} style={{
                borderTop: "1px solid #f3f4f6",
                background: i % 2 === 0 ? "#fff" : "#fafafa"
              }}>
                <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>
                  {req.id}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {req.species}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {req.quantity}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {req.date}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: "600",
                    background: STATUS_COLORS[req.status]?.bg || "#f3f4f6",
                    color: STATUS_COLORS[req.status]?.color || "#374151",
                  }}>
                    {req.status}
                  </span>
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#6b7280" }}>
                  {req.remarks || "—"}
                </td>
                {userRole === "staff" && (
                  <td style={{ padding: "14px 16px" }}>
                    {req.status === "Pending" && (
                      <button
                        onClick={() => {
                          setRequests((prev) =>
                            prev.map((r) => r.id === req.id ? { ...r, status: "Reviewed", remarks: "Verified by staff" } : r)
                          );
                        }}
                        style={{
                          padding: "6px 12px",
                          background: "#dbeafe",
                          color: "#1e40af",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        Mark Reviewed
                      </button>
                    )}
                  </td>
                )}
                {userRole === "admin" && (
                  <td style={{ padding: "14px 16px", display: "flex", gap: "8px" }}>
                    {req.status === "Reviewed" && (
                      <>
                        <button
                          onClick={() => {
                            setRequests((prev) =>
                              prev.map((r) => r.id === req.id ? { ...r, status: "Approved", remarks: "Approved by admin" } : r)
                            );
                          }}
                          style={{
                            padding: "6px 12px",
                            background: "#dcfce7",
                            color: "#166534",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setRequests((prev) =>
                              prev.map((r) => r.id === req.id ? { ...r, status: "Rejected", remarks: "Rejected by admin" } : r)
                            );
                          }}
                          style={{
                            padding: "6px 12px",
                            background: "#fee2e2",
                            color: "#991b1b",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {requests.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
            No requests found.
          </div>
        )}
      </div>
    </div>
  );
}