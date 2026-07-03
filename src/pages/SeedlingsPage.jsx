import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FiPackage, FiPlus, FiEdit2, FiAlertTriangle } from "react-icons/fi";

const SAMPLE_SEEDLINGS = [
  { id: "S001", species: "Narra", category: "Hardwood", stock: 150, released: 50, status: "Available" },
  { id: "S002", species: "Mahogany", category: "Hardwood", stock: 8, released: 92, status: "Low Stock" },
  { id: "S003", species: "Bamboo", category: "Grass", stock: 200, released: 100, status: "Available" },
  { id: "S004", species: "Molave", category: "Hardwood", stock: 0, released: 75, status: "Out of Stock" },
  { id: "S005", species: "Ipil-ipil", category: "Legume", stock: 45, released: 30, status: "Available" },
];

const STATUS_COLORS = {
  "Available": { bg: "#dcfce7", color: "#166534" },
  "Low Stock": { bg: "#fef9c3", color: "#854d0e" },
  "Out of Stock": { bg: "#fee2e2", color: "#991b1b" },
};

export default function SeedlingsPage() {
  const { userRole } = useAuth();
  const [seedlings, setSeedlings] = useState(SAMPLE_SEEDLINGS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSeedling, setSelectedSeedling] = useState(null);
  const [form, setForm] = useState({
    species: "", category: "", stock: "", description: ""
  });
  const [editForm, setEditForm] = useState({
    stock: "", description: ""
  });
  const [successMsg, setSuccessMsg] = useState("");

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const updateEdit = (field) => (e) =>
    setEditForm((prev) => ({ ...prev, [field]: e.target.value }));

  const getStatus = (stock) => {
    if (stock === 0) return "Out of Stock";
    if (stock <= 10) return "Low Stock";
    return "Available";
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.species || !form.stock) return;

    const newSeedling = {
      id: `S00${seedlings.length + 1}`,
      species: form.species,
      category: form.category || "General",
      stock: parseInt(form.stock),
      released: 0,
      status: getStatus(parseInt(form.stock)),
    };

    setSeedlings((prev) => [...prev, newSeedling]);
    setForm({ species: "", category: "", stock: "", description: "" });
    setShowAddModal(false);
    setSuccessMsg("Seedling added successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleEdit = (e) => {
    e.preventDefault();
    setSeedlings((prev) =>
      prev.map((s) =>
        s.id === selectedSeedling.id
          ? { ...s, stock: parseInt(editForm.stock), status: getStatus(parseInt(editForm.stock)) }
          : s
      )
    );
    setShowEditModal(false);
    setSuccessMsg("Inventory updated successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const lowStockCount = seedlings.filter((s) => s.status === "Low Stock").length;
  const outOfStockCount = seedlings.filter((s) => s.status === "Out of Stock").length;

  return (
    <div style={{ padding: "32px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
            Seedling Inventory
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            Manage and monitor available seedling stocks.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 18px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <FiPlus size={14} /> Add Seedling
        </button>
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

      {/* Alerts */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div style={{
          background: "#fef9c3", border: "1px solid #fde047",
          borderRadius: "10px", padding: "14px 18px",
          marginBottom: "20px", display: "flex",
          alignItems: "center", gap: "10px",
          fontSize: "13px", color: "#854d0e"
        }}>
          <FiAlertTriangle size={16} />
          <span>
            {lowStockCount > 0 && `${lowStockCount} species with low stock. `}
            {outOfStockCount > 0 && `${outOfStockCount} species out of stock.`}
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "16px", marginBottom: "24px"
      }}>
        {[
          { label: "Total Species", value: seedlings.length, icon: "🌱" },
          { label: "Available", value: seedlings.filter(s => s.status === "Available").length, icon: "✅" },
          { label: "Low Stock", value: lowStockCount, icon: "⚠️" },
          { label: "Out of Stock", value: outOfStockCount, icon: "❌" },
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

      {/* Table */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: "12px", overflow: "hidden"
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a" }}>
            All Seedlings
          </h2>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["ID", "Species", "Category", "Available Stock", "Released", "Status", "Actions"].map((h) => (
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
            {seedlings.map((s, i) => (
              <tr key={s.id} style={{
                borderTop: "1px solid #f3f4f6",
                background: i % 2 === 0 ? "#fff" : "#fafafa"
              }}>
                <td style={{ padding: "14px 16px", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>
                  {s.id}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {s.species}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {s.category}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151", fontWeight: "600" }}>
                  {s.stock}
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {s.released}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: "999px",
                    fontSize: "12px", fontWeight: "600",
                    background: STATUS_COLORS[s.status]?.bg,
                    color: STATUS_COLORS[s.status]?.color,
                  }}>
                    {s.status}
                  </span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <button
                    onClick={() => {
                      setSelectedSeedling(s);
                      setEditForm({ stock: s.stock, description: "" });
                      setShowEditModal(true);
                    }}
                    style={{
                      padding: "6px 12px",
                      background: "#f3f4f6",
                      color: "#374151",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <FiEdit2 size={11} /> Update Stock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
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
              Add New Seedling
            </h2>
            <form onSubmit={handleAdd}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Species Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Narra"
                    value={form.species}
                    onChange={update("species")}
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: "1px solid #e5e7eb", borderRadius: "8px",
                      fontSize: "13px", boxSizing: "border-box"
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={update("category")}
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: "1px solid #e5e7eb", borderRadius: "8px",
                      fontSize: "13px", background: "#fff"
                    }}
                  >
                    <option value="">Select category</option>
                    <option value="Hardwood">Hardwood</option>
                    <option value="Softwood">Softwood</option>
                    <option value="Grass">Grass</option>
                    <option value="Legume">Legume</option>
                    <option value="Fruit">Fruit</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Initial Stock *
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 100"
                    value={form.stock}
                    onChange={update("stock")}
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: "1px solid #e5e7eb", borderRadius: "8px",
                      fontSize: "13px", boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                    color: "#fff", border: "none",
                    borderRadius: "8px", fontSize: "13px",
                    fontWeight: "600", cursor: "pointer"
                  }}
                >
                  Add Seedling
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit/Update Stock Modal */}
      {showEditModal && selectedSeedling && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "#fff", borderRadius: "16px",
            padding: "28px", width: "400px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)"
          }}>
            <h2 style={{ fontSize: "17px", fontWeight: "700", marginBottom: "6px" }}>
              Update Stock
            </h2>
            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "20px" }}>
              {selectedSeedling.species} — Current stock: {selectedSeedling.stock}
            </p>
            <form onSubmit={handleEdit}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                  New Stock Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  value={editForm.stock}
                  onChange={updateEdit("stock")}
                  style={{
                    width: "100%", padding: "10px 12px",
                    border: "1px solid #e5e7eb", borderRadius: "8px",
                    fontSize: "13px", boxSizing: "border-box"
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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
                    color: "#fff", border: "none",
                    borderRadius: "8px", fontSize: "13px",
                    fontWeight: "600", cursor: "pointer"
                  }}
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}