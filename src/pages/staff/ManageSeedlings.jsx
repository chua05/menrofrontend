import { useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiDownload } from "react-icons/fi";

const initialSeedlings = [
  { id: 1, name: "Pili", category: "Fruit Tree", initial: 1500, distributed: 260, remaining: 1240, source: "Municipal Nursery", status: "Good" },
  { id: 2, name: "Lansones", category: "Fruit Tree", initial: 2000, distributed: 550, remaining: 1450, source: "Municipal Nursery", status: "Good" },
  { id: 3, name: "Kasuy", category: "Fruit Tree", initial: 1900, distributed: 400, remaining: 850, source: "Municipal Nursery", status: "Low" },
  { id: 4, name: "Calamansi", category: "Fruit Tree", initial: 1000, distributed: 300, remaining: 700, source: "Municipal Nursery", status: "Good" },
  { id: 5, name: "Narra", category: "Hardwood", initial: 800, distributed: 200, remaining: 600, source: "DENR Nursery", status: "Good" },
  { id: 6, name: "Mahogany", category: "Hardwood", initial: 600, distributed: 580, remaining: 20, source: "DENR Nursery", status: "Critical" },
  { id: 7, name: "Coconut", category: "Palm", initial: 3000, distributed: 1200, remaining: 1800, source: "LGU Nursery", status: "Good" },
];

const statusStyle = {
  Good:     { bg: "#dcfce7", color: "#166534" },
  Low:      { bg: "#fef3c7", color: "#92400e" },
  Critical: { bg: "#fee2e2", color: "#dc2626" },
};

const summaryCards = [
  { label: "Total Inventory", value: "12,450", icon: "🌱", sub: "All seedling types" },
  { label: "Average Health", value: "84.2%", icon: "📊", sub: "Based on stock condition" },
  { label: "Pending Requests", value: "08", icon: "📋", sub: "Awaiting processing" },
  { label: "Distributed", value: "3,820", icon: "📦", sub: "Total released" },
];

export default function ManageSeedlings() {
  const [seedlings, setSeedlings] = useState(initialSeedlings);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    name: "", category: "", initial: "", source: "",
  });

  const filtered = seedlings.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: "", category: "", initial: "", source: "" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name,
      category: item.category,
      initial: item.initial,
      source: item.source,
    });
    setShowModal(true);
  };

  const handleDelete = (id) => {
    setSeedlings((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSave = () => {
    if (!form.name || !form.category || !form.initial) return;
    if (editItem) {
      setSeedlings((prev) => prev.map((s) =>
        s.id === editItem.id
          ? { ...s, ...form, initial: Number(form.initial), remaining: Number(form.initial) - s.distributed }
          : s
      ));
    } else {
      const newItem = {
        id: Date.now(),
        name: form.name,
        category: form.category,
        initial: Number(form.initial),
        distributed: 0,
        remaining: Number(form.initial),
        source: form.source,
        status: "Good",
      };
      setSeedlings((prev) => [...prev, newItem]);
    }
    setShowModal(false);
  };

  return (
    <div className="page-wrapper">

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: "24px",
      }}>
        <div>
          <div className="page-title">Manage Seedlings</div>
          <div className="page-subtitle">
            Monitor and manage seedling inventory, stock levels, and distribution records.
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={{
            height: "34px", padding: "0 14px",
            background: "#fff", border: "1px solid #ede9e4",
            borderRadius: "8px", fontSize: "12px", color: "#78716c",
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            <FiDownload size={13} /> Export Report
          </button>
          <button
            onClick={openAdd}
            style={{
              height: "34px", padding: "0 14px",
              background: "#166534", border: "none",
              borderRadius: "8px", fontSize: "12px", color: "#fff",
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
            <FiPlus size={13} /> Add New Seedling
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "12px",
        marginBottom: "20px",
      }}>
        {summaryCards.map((c) => (
          <div key={c.label} style={{
            background: "#fff",
            border: "1px solid #ede9e4",
            borderRadius: "10px",
            padding: "14px 16px",
          }}>
            <div style={{ fontSize: "20px", marginBottom: "8px" }}>{c.icon}</div>
            <div style={{
              fontSize: "24px",
              fontFamily: "'DM Serif Display', serif",
              color: "#1c1917",
              lineHeight: 1,
              marginBottom: "4px",
            }}>
              {c.value}
            </div>
            <div style={{ fontSize: "11px", color: "#78716c", fontWeight: 400 }}>
              {c.label}
            </div>
            <div style={{ fontSize: "10px", color: "#c4bfba", fontWeight: 300, marginTop: "2px" }}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: "#fff",
        border: "1px solid #ede9e4",
        borderRadius: "10px",
        overflow: "hidden",
      }}>

        {/* Table header */}
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid #f5f4f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#1c1917" }}>
            Seedling Inventory
          </div>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <FiSearch style={{
              position: "absolute", left: "10px",
              top: "50%", transform: "translateY(-50%)",
              color: "#c4bfba", fontSize: "13px",
            }} />
            <input
              type="text"
              placeholder="Search seedlings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                height: "32px",
                padding: "0 12px 0 32px",
                border: "1px solid #ede9e4",
                borderRadius: "7px",
                fontSize: "12px",
                fontFamily: "'DM Sans', sans-serif",
                color: "#1c1917",
                background: "#faf9f6",
                outline: "none",
                width: "200px",
              }}
            />
          </div>
        </div>

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#faf9f6" }}>
              {["Species Name", "Category", "Initial Stock", "Distributed", "Remaining", "Source", "Status", "Actions"].map((h) => (
                <th key={h} style={{
                  padding: "9px 14px",
                  textAlign: "left",
                  fontSize: "10px",
                  color: "#a8a29e",
                  fontWeight: 500,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  borderBottom: "1px solid #ede9e4",
                  whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const s = statusStyle[row.status];
              return (
                <tr key={row.id} style={{ borderBottom: "1px solid #f5f4f0" }}>
                  <td style={{
                    padding: "11px 14px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#1c1917",
                  }}>
                    {row.name}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: "12px", color: "#78716c" }}>
                    {row.category}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: "12px", color: "#78716c" }}>
                    {row.initial.toLocaleString()}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: "12px", color: "#78716c" }}>
                    {row.distributed.toLocaleString()}
                  </td>
                  <td style={{
                    padding: "11px 14px",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: row.remaining < 100 ? "#dc2626" : "#166534",
                  }}>
                    {row.remaining.toLocaleString()}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: "12px", color: "#78716c" }}>
                    {row.source}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      background: s.bg,
                      color: s.color,
                      padding: "3px 9px",
                      borderRadius: "10px",
                    }}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => openEdit(row)}
                        style={{
                          width: 28, height: 28,
                          border: "1px solid #ede9e4",
                          borderRadius: "6px",
                          background: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#78716c",
                        }}>
                        <FiEdit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        style={{
                          width: 28, height: 28,
                          border: "1px solid #fecaca",
                          borderRadius: "6px",
                          background: "#fff5f5",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#dc2626",
                        }}>
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Table footer */}
        <div style={{
          padding: "10px 16px",
          background: "#faf9f6",
          borderTop: "1px solid #ede9e4",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: "11px", color: "#a8a29e" }}>
            Showing {filtered.length} of {seedlings.length} seedling types
          </span>
          <div style={{ display: "flex", gap: "6px" }}>
            <button style={{
              height: "28px", padding: "0 10px",
              border: "1px solid #ede9e4", borderRadius: "6px",
              background: "#fff", fontSize: "11px",
              color: "#78716c", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}>
              Update Stock
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,.4)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "24px",
            width: "100%",
            maxWidth: "420px",
            boxShadow: "0 20px 60px rgba(0,0,0,.15)",
          }}>
            <div style={{
              fontSize: "15px",
              fontWeight: 500,
              color: "#1c1917",
              marginBottom: "20px",
            }}>
              {editItem ? "Edit Seedling" : "Add New Seedling"}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { label: "Species Name", key: "name", placeholder: "e.g. Pili" },
                { label: "Category", key: "category", placeholder: "e.g. Fruit Tree" },
                { label: "Initial Stock", key: "initial", placeholder: "e.g. 1000", type: "number" },
                { label: "Source", key: "source", placeholder: "e.g. Municipal Nursery" },
              ].map((f) => (
                <div key={f.key}>
                  <label style={{
                    display: "block",
                    fontSize: "10.5px",
                    fontWeight: 500,
                    color: "#78716c",
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}>
                    {f.label}
                  </label>
                  <input
                    type={f.type || "text"}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      border: "1px solid #e7e5e4",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontFamily: "'DM Sans', sans-serif",
                      color: "#1c1917",
                      outline: "none",
                      background: "#faf9f6",
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{
              display: "flex",
              gap: "8px",
              marginTop: "20px",
              justifyContent: "flex-end",
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  height: "36px", padding: "0 16px",
                  border: "1px solid #ede9e4",
                  borderRadius: "8px",
                  background: "#fff",
                  fontSize: "12px",
                  color: "#78716c",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  height: "36px", padding: "0 16px",
                  border: "none",
                  borderRadius: "8px",
                  background: "#166534",
                  fontSize: "12px",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                }}>
                {editItem ? "Save Changes" : "Add Seedling"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}