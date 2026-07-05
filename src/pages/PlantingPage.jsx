import { useState } from "react";
import { useAuth } from "../context/useAuth";
import { FiPlus, FiEye, FiCamera, FiMapPin } from "react-icons/fi";

const SAMPLE_PLANTING = [
  {
    id: "PLT-001",
    participant: "Juan Dela Cruz",
    site: "Tughan Reforestation Area",
    species: "Narra",
    quantity: 10,
    date: "2026-07-01",
    event: "Juban Reforestation Drive",
    photo: null,
    gps: "12.3456, 124.5678",
    timestamp: "2026-07-01 08:23 AM",
    verificationStatus: "Verified",
    remarks: "Successfully planted 10 Narra seedlings.",
  },
  {
    id: "PLT-002",
    participant: "Maria Santos",
    site: "Coastal Mangrove Zone",
    species: "Mangrove",
    quantity: 25,
    date: "2026-07-02",
    event: "Coastal Mangrove Planting",
    photo: null,
    gps: "12.3478, 124.5690",
    timestamp: "2026-07-02 07:45 AM",
    verificationStatus: "Pending",
    remarks: "Planted along the coastal area.",
  },
  {
    id: "PLT-003",
    participant: "Pedro Reyes",
    site: "School Greening Zone",
    species: "Ipil-ipil",
    quantity: 15,
    date: "2026-06-10",
    event: "School Greening Program",
    photo: null,
    gps: "12.3490, 124.5700",
    timestamp: "2026-06-10 09:12 AM",
    verificationStatus: "Verified",
    remarks: "All seedlings planted successfully.",
  },
];

const VERIFICATION_COLORS = {
  "Verified": { bg: "#dcfce7", color: "#166534" },
  "Pending": { bg: "#fef9c3", color: "#854d0e" },
  "Rejected": { bg: "#fee2e2", color: "#991b1b" },
};

const SITES = ["Tughan Reforestation Area", "Coastal Mangrove Zone", "School Greening Zone"];
const SPECIES = ["Narra", "Mahogany", "Bamboo", "Molave", "Ipil-ipil", "Mangrove"];
const EVENTS = ["Juban Reforestation Drive", "Coastal Mangrove Planting", "School Greening Program"];

export default function PlantingPage() {
  const { userRole } = useAuth();
  const [records, setRecords] = useState(SAMPLE_PLANTING);
  const [showForm, setShowForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    site: "", species: "", quantity: "",
    event: "", gps: "", remarks: ""
  });

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.site || !form.species || !form.quantity) return;

    const newRecord = {
      id: `PLT-00${records.length + 1}`,
      participant: "Current User",
      site: form.site,
      species: form.species,
      quantity: parseInt(form.quantity),
      date: new Date().toISOString().split("T")[0],
      event: form.event || "Independent Planting",
      photo: null,
      gps: form.gps || "Not captured",
      timestamp: new Date().toLocaleString(),
      verificationStatus: "Pending",
      remarks: form.remarks,
    };

    setRecords((prev) => [newRecord, ...prev]);
    setForm({ site: "", species: "", quantity: "", event: "", gps: "", remarks: "" });
    setShowForm(false);
    setSuccessMsg("Planting report submitted successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div style={{ padding: "32px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
            Planting Records
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            {userRole === "participant"
              ? "Submit and track your planting activity records."
              : "View and verify all planting activity submissions."}
          </p>
        </div>
        {userRole === "participant" && (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              background: "#16a34a", color: "#fff",
              border: "none", borderRadius: "8px",
              padding: "10px 18px", fontSize: "13px",
              fontWeight: "600", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <FiPlus size={14} /> Submit Record
          </button>
        )}
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
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "16px", marginBottom: "24px"
      }}>
        {[
          { label: "Total Records", value: records.length, icon: "📋" },
          { label: "Verified", value: records.filter(r => r.verificationStatus === "Verified").length, icon: "✅" },
          { label: "Pending", value: records.filter(r => r.verificationStatus === "Pending").length, icon: "⏳" },
          { label: "Total Trees Planted", value: records.reduce((acc, r) => acc + r.quantity, 0), icon: "🌳" },
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

      {/* Submit Form — Participant only */}
      {showForm && userRole === "participant" && (
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: "12px", padding: "24px",
          marginBottom: "24px"
        }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "20px" }}>
            Submit Planting Record
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>Planting Site *</label>
                <select value={form.site} onChange={update("site")}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", background: "#fff" }}
                >
                  <option value="">Select site</option>
                  {SITES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>Tree Species *</label>
                <select value={form.species} onChange={update("species")}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", background: "#fff" }}
                >
                  <option value="">Select species</option>
                  {SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>Quantity Planted *</label>
                <input type="number" min="1" placeholder="e.g. 10"
                  value={form.quantity} onChange={update("quantity")}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>Related Event</label>
                <select value={form.event} onChange={update("event")}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", background: "#fff" }}
                >
                  <option value="">Select event (optional)</option>
                  {EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>GPS Location</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input type="text" placeholder="e.g. 12.3456, 124.5678"
                    value={form.gps} onChange={update("gps")}
                    style={{ flex: 1, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                  <button type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition((pos) => {
                          setForm(prev => ({
                            ...prev,
                            gps: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`
                          }));
                        });
                      }
                    }}
                    style={{
                      padding: "10px 14px", background: "#f3f4f6",
                      color: "#374151", border: "1px solid #e5e7eb",
                      borderRadius: "8px", fontSize: "13px",
                      cursor: "pointer", display: "flex",
                      alignItems: "center", gap: "6px"
                    }}
                  >
                    <FiMapPin size={13} /> Capture GPS
                  </button>
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>Upload Photo</label>
                <div style={{
                  border: "2px dashed #e5e7eb", borderRadius: "8px",
                  padding: "20px", textAlign: "center",
                  color: "#9ca3af", fontSize: "13px", cursor: "pointer"
                }}>
                  <FiCamera size={20} style={{ marginBottom: "6px" }} />
                  <div>Click to upload planting photo</div>
                  <div style={{ fontSize: "11px", marginTop: "4px" }}>JPG, PNG up to 10MB</div>
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>Remarks</label>
                <textarea placeholder="Additional notes about the planting activity..."
                  value={form.remarks} onChange={update("remarks")} rows={3}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: "10px 18px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", background: "#fff", cursor: "pointer" }}
              >Cancel</button>
              <button type="submit"
                style={{ padding: "10px 18px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
              >Submit</button>
            </div>
          </form>
        </div>
      )}

      {/* Records Table */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: "12px", overflow: "hidden"
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a" }}>
            {userRole === "participant" ? "My Planting Records" : "All Planting Records"}
          </h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["ID", "Participant", "Site", "Species", "Qty", "Date", "Status", "Actions"].map((h) => (
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
            {records.map((r, i) => (
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
                    background: VERIFICATION_COLORS[r.verificationStatus]?.bg,
                    color: VERIFICATION_COLORS[r.verificationStatus]?.color,
                  }}>{r.verificationStatus}</span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <button
                    onClick={() => { setSelectedRecord(r); setShowViewModal(true); }}
                    style={{
                      padding: "6px 12px",
                      background: "#f3f4f6", color: "#374151",
                      border: "none", borderRadius: "6px",
                      fontSize: "12px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "4px"
                    }}
                  >
                    <FiEye size={11} /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {showViewModal && selectedRecord && (
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
              <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0 }}>Planting Record</h2>
              <span style={{
                padding: "4px 10px", borderRadius: "999px",
                fontSize: "11px", fontWeight: "600",
                background: VERIFICATION_COLORS[selectedRecord.verificationStatus]?.bg,
                color: VERIFICATION_COLORS[selectedRecord.verificationStatus]?.color,
              }}>{selectedRecord.verificationStatus}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { label: "Record ID", value: selectedRecord.id },
                { label: "Participant", value: selectedRecord.participant },
                { label: "Site", value: selectedRecord.site },
                { label: "Species", value: selectedRecord.species },
                { label: "Quantity", value: selectedRecord.quantity },
                { label: "Event", value: selectedRecord.event },
                { label: "Date", value: selectedRecord.date },
                { label: "Timestamp", value: selectedRecord.timestamp },
                { label: "GPS", value: selectedRecord.gps },
                { label: "Remarks", value: selectedRecord.remarks },
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
    </div>
  );
}