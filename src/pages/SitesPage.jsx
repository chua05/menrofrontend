import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FiMapPin, FiPlus, FiEye, FiEdit2, FiTrash2 } from "react-icons/fi";

const SAMPLE_SITES = [
  {
    id: "SITE-001",
    name: "Tughan Reforestation Area",
    barangay: "Barangay Tughan",
    gps: "12.3456, 124.5678",
    area: "2.5 hectares",
    species: ["Narra", "Mahogany"],
    treeCount: 150,
    status: "Active",
    description: "Primary reforestation site in Barangay Tughan.",
  },
  {
    id: "SITE-002",
    name: "Coastal Mangrove Zone",
    barangay: "Barangay Bulan Shore",
    gps: "12.3478, 124.5690",
    area: "1.8 hectares",
    species: ["Mangrove", "Bamboo"],
    treeCount: 200,
    status: "Active",
    description: "Coastal mangrove restoration area.",
  },
  {
    id: "SITE-003",
    name: "School Greening Zone",
    barangay: "Juban Central School",
    gps: "12.3490, 124.5700",
    area: "0.5 hectares",
    species: ["Ipil-ipil", "Acacia"],
    treeCount: 75,
    status: "Completed",
    description: "School greening program planting site.",
  },
];

const STATUS_COLORS = {
  "Active": { bg: "#dcfce7", color: "#166534" },
  "Completed": { bg: "#dbeafe", color: "#1e40af" },
  "Inactive": { bg: "#fee2e2", color: "#991b1b" },
};

export default function SitesPage() {
  const { userRole } = useAuth();
  const [sites, setSites] = useState(SAMPLE_SITES);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    name: "", barangay: "", gps: "",
    area: "", description: ""
  });

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name || !form.barangay) return;

    const newSite = {
      id: `SITE-00${sites.length + 1}`,
      name: form.name,
      barangay: form.barangay,
      gps: form.gps || "Not set",
      area: form.area || "Not set",
      species: [],
      treeCount: 0,
      status: "Active",
      description: form.description,
    };

    setSites((prev) => [...prev, newSite]);
    setForm({ name: "", barangay: "", gps: "", area: "", description: "" });
    setShowAddModal(false);
    setSuccessMsg("Site added successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleDelete = (id) => {
    setSites((prev) => prev.filter((s) => s.id !== id));
    setSuccessMsg("Site deleted.");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div style={{ padding: "32px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
            Planting Sites
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            {userRole === "participant"
              ? "View your assigned planting sites."
              : "Manage registered planting and reforestation sites."}
          </p>
        </div>
        {(userRole === "admin" || userRole === "staff") && (
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              background: "#16a34a", color: "#fff",
              border: "none", borderRadius: "8px",
              padding: "10px 18px", fontSize: "13px",
              fontWeight: "600", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <FiPlus size={14} /> Add Site
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
          { label: "Total Sites", value: sites.length, icon: "📍" },
          { label: "Active Sites", value: sites.filter(s => s.status === "Active").length, icon: "✅" },
          { label: "Total Trees", value: sites.reduce((acc, s) => acc + s.treeCount, 0), icon: "🌳" },
          { label: "Completed", value: sites.filter(s => s.status === "Completed").length, icon: "🏁" },
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

      {/* Map Placeholder */}
      <div style={{
        background: "#f0fdf4", border: "2px dashed #86efac",
        borderRadius: "12px", padding: "32px",
        textAlign: "center", marginBottom: "24px",
        color: "#166534"
      }}>
        <FiMapPin size={32} style={{ marginBottom: "8px" }} />
        <div style={{ fontSize: "15px", fontWeight: "600", marginBottom: "4px" }}>
          Interactive Map
        </div>
        <div style={{ fontSize: "13px", color: "#4ade80" }}>
          Google Maps integration will display geo-tagged planting sites here.
        </div>
      </div>

      {/* Sites Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "16px"
      }}>
        {sites.map((site) => (
          <div key={site.id} style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "12px", padding: "20px",
            display: "flex", flexDirection: "column", gap: "12px"
          }}>
            {/* Site header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", marginBottom: "4px" }}>
                  {site.id}
                </div>
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
                  {site.name}
                </h3>
              </div>
              <span style={{
                padding: "4px 10px", borderRadius: "999px",
                fontSize: "11px", fontWeight: "600",
                background: STATUS_COLORS[site.status]?.bg,
                color: STATUS_COLORS[site.status]?.color,
              }}>
                {site.status}
              </span>
            </div>

            {/* Site details */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#6b7280" }}>
                <FiMapPin size={13} />
                {site.barangay}
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>
                📐 Area: {site.area}
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>
                🌳 Trees: {site.treeCount}
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>
                🌱 Species: {site.species.join(", ") || "Not specified"}
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>
                📌 GPS: {site.gps}
              </div>
            </div>

            <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>
              {site.description}
            </p>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => { setSelectedSite(site); setShowViewModal(true); }}
                style={{
                  flex: 1, padding: "8px 14px",
                  background: "#f3f4f6", color: "#374151",
                  border: "none", borderRadius: "8px",
                  fontSize: "13px", fontWeight: "600",
                  cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center", gap: "4px"
                }}
              >
                <FiEye size={12} /> View
              </button>
              {(userRole === "admin") && (
                <button
                  onClick={() => handleDelete(site.id)}
                  style={{
                    padding: "8px 14px",
                    background: "#fee2e2", color: "#991b1b",
                    border: "none", borderRadius: "8px",
                    fontSize: "13px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "4px"
                  }}
                >
                  <FiTrash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Site Modal */}
      {showAddModal && (
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
            <h2 style={{ fontSize: "17px", fontWeight: "700", marginBottom: "20px" }}>
              Add New Site
            </h2>
            <form onSubmit={handleAdd}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>Site Name *</label>
                  <input type="text" placeholder="e.g. Tughan Reforestation Area"
                    value={form.name} onChange={update("name")}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>Barangay *</label>
                  <input type="text" placeholder="e.g. Barangay Tughan"
                    value={form.barangay} onChange={update("barangay")}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>GPS Coordinates</label>
                  <input type="text" placeholder="e.g. 12.3456, 124.5678"
                    value={form.gps} onChange={update("gps")}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>Area</label>
                  <input type="text" placeholder="e.g. 2.5 hectares"
                    value={form.area} onChange={update("area")}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>Description</label>
                  <textarea placeholder="Brief description of the site..."
                    value={form.description} onChange={update("description")}
                    rows={3}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", resize: "vertical", boxSizing: "border-box" }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowAddModal(false)}
                  style={{ padding: "10px 18px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", background: "#fff", cursor: "pointer" }}
                >Cancel</button>
                <button type="submit"
                  style={{ padding: "10px 18px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                >Add Site</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Site Modal */}
      {showViewModal && selectedSite && (
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
              <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0 }}>Site Details</h2>
              <span style={{
                padding: "4px 10px", borderRadius: "999px",
                fontSize: "11px", fontWeight: "600",
                background: STATUS_COLORS[selectedSite.status]?.bg,
                color: STATUS_COLORS[selectedSite.status]?.color,
              }}>{selectedSite.status}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { label: "Site ID", value: selectedSite.id },
                { label: "Site Name", value: selectedSite.name },
                { label: "Barangay", value: selectedSite.barangay },
                { label: "GPS Coordinates", value: selectedSite.gps },
                { label: "Area", value: selectedSite.area },
                { label: "Tree Count", value: selectedSite.treeCount },
                { label: "Species", value: selectedSite.species.join(", ") || "Not specified" },
                { label: "Description", value: selectedSite.description },
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
