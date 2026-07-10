import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FiMapPin, FiCamera, FiPlus, FiEye, FiTrendingUp } from "react-icons/fi";

const SAMPLE_RECORDS = [
  {
    id: "MON-001",
    site: "Barangay Tughan",
    species: "Narra",
    participant: "Juan Dela Cruz",
    date: "2026-07-01",
    condition: "Healthy",
    height: "1.2m",
    photo: null,
    gps: "12.3456, 124.5678",
    remarks: "Growing well, no signs of disease.",
  },
  {
    id: "MON-002",
    site: "Barangay Bulan Shore",
    species: "Mahogany",
    participant: "Maria Santos",
    date: "2026-07-02",
    condition: "Damaged",
    height: "0.8m",
    photo: null,
    gps: "12.3478, 124.5690",
    remarks: "Leaves showing signs of pest damage.",
  },
  {
    id: "MON-003",
    site: "Juban Central School",
    species: "Bamboo",
    participant: "Pedro Reyes",
    date: "2026-07-03",
    condition: "Healthy",
    height: "2.5m",
    photo: null,
    gps: "12.3490, 124.5700",
    remarks: "Excellent growth rate.",
  },
  {
    id: "MON-004",
    site: "Barangay Tughan",
    species: "Molave",
    participant: "Ana Garcia",
    date: "2026-07-04",
    condition: "Dead",
    height: "0.3m",
    photo: null,
    gps: "12.3460, 124.5670",
    remarks: "Tree did not survive due to drought.",
  },
];

const CONDITION_COLORS = {
  "Healthy": { bg: "#dcfce7", color: "#166534" },
  "Damaged": { bg: "#fef9c3", color: "#854d0e" },
  "Dead": { bg: "#fee2e2", color: "#991b1b" },
};

const SITES = [
  "Barangay Tughan",
  "Barangay Bulan Shore",
  "Juban Central School",
  "Barangay Gatbo",
  "Barangay Togawe",
];

const SPECIES = ["Narra", "Mahogany", "Bamboo", "Molave", "Ipil-ipil", "Acacia"];

export default function MonitoringPage() {
  const { userRole } = useAuth();
  const [records, setRecords] = useState(SAMPLE_RECORDS);
  const [showForm, setShowForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    site: "", species: "", condition: "",
    height: "", remarks: "", gps: ""
  });

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.site || !form.species || !form.condition) return;

    const newRecord = {
      id: `MON-00${records.length + 1}`,
      site: form.site,
      species: form.species,
      participant: "Current User",
      date: new Date().toISOString().split("T")[0],
      condition: form.condition,
      height: form.height || "N/A",
      photo: null,
      gps: form.gps || "Not captured",
      remarks: form.remarks,
    };

    setRecords((prev) => [...prev, newRecord]);
    setForm({ site: "", species: "", condition: "", height: "", remarks: "", gps: "" });
    setShowForm(false);
    setSuccessMsg("Monitoring report submitted successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleUpdateCondition = (id, newCondition) => {
    setRecords((prev) =>
      prev.map((r) => r.id === id ? { ...r, condition: newCondition } : r)
    );
    setSuccessMsg("Tree condition updated!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  // Survival rate calculation
  const totalTrees = records.length;
  const healthyTrees = records.filter(r => r.condition === "Healthy").length;
  const survivalRate = totalTrees > 0 ? Math.round((healthyTrees / totalTrees) * 100) : 0;

  return (
    <div style={{ padding: "32px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
            Tree Monitoring
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            {userRole === "participant"
              ? "Submit geo-tagged monitoring reports for your assigned trees."
              : "Monitor and update tree survival status across all planting sites."}
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
            <FiPlus size={14} /> Submit Report
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
          { label: "Total Trees", value: totalTrees, icon: "🌳" },
          { label: "Healthy", value: healthyTrees, icon: "💚" },
          { label: "Damaged", value: records.filter(r => r.condition === "Damaged").length, icon: "⚠️" },
          { label: "Dead", value: records.filter(r => r.condition === "Dead").length, icon: "💀" },
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

      {/* Survival Rate */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: "12px", padding: "20px",
        marginBottom: "24px",
        display: "flex", alignItems: "center", gap: "16px"
      }}>
        <FiTrendingUp size={24} color="#16a34a" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px", fontWeight: "500" }}>
            Overall Tree Survival Rate
          </div>
          <div style={{
            background: "#f3f4f6", borderRadius: "999px",
            height: "10px", overflow: "hidden"
          }}>
            <div style={{
              background: "#16a34a", height: "100%",
              width: `${survivalRate}%`,
              borderRadius: "999px",
              transition: "width 0.3s ease"
            }} />
          </div>
        </div>
        <div style={{ fontSize: "24px", fontWeight: "700", color: "#16a34a" }}>
          {survivalRate}%
        </div>
      </div>

      {/* Submit Form — Participant only */}
      {showForm && userRole === "participant" && (
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: "12px", padding: "24px",
          marginBottom: "24px"
        }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>
            Submit Monitoring Report
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                  Planting Site *
                </label>
                <select
                  value={form.site}
                  onChange={update("site")}
                  style={{
                    width: "100%", padding: "10px 12px",
                    border: "1px solid #e5e7eb", borderRadius: "8px",
                    fontSize: "13px", background: "#fff"
                  }}
                >
                  <option value="">Select site</option>
                  {SITES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                  Tree Species *
                </label>
                <select
                  value={form.species}
                  onChange={update("species")}
                  style={{
                    width: "100%", padding: "10px 12px",
                    border: "1px solid #e5e7eb", borderRadius: "8px",
                    fontSize: "13px", background: "#fff"
                  }}
                >
                  <option value="">Select species</option>
                  {SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                  Tree Condition *
                </label>
                <select
                  value={form.condition}
                  onChange={update("condition")}
                  style={{
                    width: "100%", padding: "10px 12px",
                    border: "1px solid #e5e7eb", borderRadius: "8px",
                    fontSize: "13px", background: "#fff"
                  }}
                >
                  <option value="">Select condition</option>
                  <option value="Healthy">🟢 Healthy</option>
                  <option value="Damaged">🟡 Damaged</option>
                  <option value="Dead">🔴 Dead</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                  Tree Height (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1.5m"
                  value={form.height}
                  onChange={update("height")}
                  style={{
                    width: "100%", padding: "10px 12px",
                    border: "1px solid #e5e7eb", borderRadius: "8px",
                    fontSize: "13px", boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                  GPS Location
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="e.g. 12.3456, 124.5678"
                    value={form.gps}
                    onChange={update("gps")}
                    style={{
                      flex: 1, padding: "10px 12px",
                      border: "1px solid #e5e7eb", borderRadius: "8px",
                      fontSize: "13px", boxSizing: "border-box"
                    }}
                  />
                  <button
                    type="button"
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
                      padding: "10px 14px",
                      background: "#f3f4f6", color: "#374151",
                      border: "1px solid #e5e7eb", borderRadius: "8px",
                      fontSize: "13px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "6px"
                    }}
                  >
                    <FiMapPin size={13} /> Capture GPS
                  </button>
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                  Upload Photo
                </label>
                <div style={{
                  border: "2px dashed #e5e7eb", borderRadius: "8px",
                  padding: "20px", textAlign: "center",
                  color: "#9ca3af", fontSize: "13px", cursor: "pointer"
                }}>
                  <FiCamera size={20} style={{ marginBottom: "6px" }} />
                  <div>Click to upload monitoring photo</div>
                  <div style={{ fontSize: "11px", marginTop: "4px" }}>JPG, PNG up to 10MB</div>
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                  Remarks
                </label>
                <textarea
                  placeholder="Describe the current condition of the tree..."
                  value={form.remarks}
                  onChange={update("remarks")}
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 12px",
                    border: "1px solid #e5e7eb", borderRadius: "8px",
                    fontSize: "13px", resize: "vertical",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  padding: "10px 18px", border: "1px solid #e5e7eb",
                  borderRadius: "8px", fontSize: "13px",
                  background: "#fff", cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: "10px 18px", background: "#16a34a",
                  color: "#fff", border: "none", borderRadius: "8px",
                  fontSize: "13px", fontWeight: "600", cursor: "pointer"
                }}
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Monitoring Records Table */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: "12px", overflow: "hidden"
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a" }}>
            Monitoring Records
          </h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["ID", "Site", "Species", "Participant", "Date", "Condition", "Height", "Actions"].map((h) => (
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
            {records.map((r, i) => (
              <tr key={r.id} style={{
                borderTop: "1px solid #f3f4f6",
                background: i % 2 === 0 ? "#fff" : "#fafafa"
              }}>
                <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>
                  {r.id}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {r.site}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {r.species}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {r.participant}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {r.date}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: "999px",
                    fontSize: "12px", fontWeight: "600",
                    background: CONDITION_COLORS[r.condition]?.bg,
                    color: CONDITION_COLORS[r.condition]?.color,
                  }}>
                    {r.condition}
                  </span>
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {r.height}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => { setSelectedRecord(r); setShowViewModal(true); }}
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
                    {(userRole === "admin" || userRole === "staff") && r.condition !== "Healthy" && (
                      <button
                        onClick={() => handleUpdateCondition(r.id, "Healthy")}
                        style={{
                          padding: "6px 10px",
                          background: "#dcfce7", color: "#166534",
                          border: "none", borderRadius: "6px",
                          fontSize: "12px", cursor: "pointer",
                        }}
                      >
                        Mark Healthy
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Record Modal */}
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
              <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0 }}>
                Monitoring Record
              </h2>
              <span style={{
                padding: "4px 10px", borderRadius: "999px",
                fontSize: "11px", fontWeight: "600",
                background: CONDITION_COLORS[selectedRecord.condition]?.bg,
                color: CONDITION_COLORS[selectedRecord.condition]?.color,
              }}>
                {selectedRecord.condition}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { label: "Record ID", value: selectedRecord.id },
                { label: "Site", value: selectedRecord.site },
                { label: "Species", value: selectedRecord.species },
                { label: "Participant", value: selectedRecord.participant },
                { label: "Date", value: selectedRecord.date },
                { label: "Height", value: selectedRecord.height },
                { label: "GPS Coordinates", value: selectedRecord.gps },
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
              <button
                onClick={() => setShowViewModal(false)}
                style={{
                  padding: "10px 18px", border: "1px solid #e5e7eb",
                  borderRadius: "8px", fontSize: "13px",
                  background: "#fff", cursor: "pointer"
                }}
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