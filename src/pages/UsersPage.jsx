import { useState } from "react";
import { FiUser, FiMail, FiPhone, FiEdit2, FiTrash2, FiPlus, FiSearch } from "react-icons/fi";

const SAMPLE_USERS = [
  { id: "USR-001", fullName: "Maria Santos", email: "maria@menro.gov.ph", contact: "09123456789", role: "admin", barangay: "Juban Proper", status: "Active" },
  { id: "USR-002", fullName: "Juan Dela Cruz", email: "juan@menro.gov.ph", contact: "09234567890", role: "staff", barangay: "Juban Proper", status: "Active" },
  { id: "USR-003", fullName: "Pedro Reyes", email: "pedro@gmail.com", contact: "09345678901", role: "participant", barangay: "Barangay Tughan", status: "Active" },
  { id: "USR-004", fullName: "Ana Garcia", email: "ana@gmail.com", contact: "09456789012", role: "participant", barangay: "Barangay Bulan Shore", status: "Inactive" },
  { id: "USR-005", fullName: "Jose Rizal", email: "jose@gmail.com", contact: "09567890123", role: "staff", barangay: "Juban Proper", status: "Active" },
];

const ROLE_COLORS = {
  "admin": { bg: "#ede9fe", color: "#6d28d9" },
  "staff": { bg: "#dbeafe", color: "#1e40af" },
  "participant": { bg: "#dcfce7", color: "#166534" },
};

const STATUS_COLORS = {
  "Active": { bg: "#dcfce7", color: "#166534" },
  "Inactive": { bg: "#fee2e2", color: "#991b1b" },
};

export default function UsersPage() {
  const [users, setUsers] = useState(SAMPLE_USERS);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    fullName: "", email: "", contact: "",
    role: "participant", barangay: ""
  });

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const filtered = users.filter((u) => {
    const matchSearch = u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email) return;

    const newUser = {
      id: `USR-00${users.length + 1}`,
      fullName: form.fullName,
      email: form.email,
      contact: form.contact,
      role: form.role,
      barangay: form.barangay,
      status: "Active",
    };

    setUsers((prev) => [...prev, newUser]);
    setForm({ fullName: "", email: "", contact: "", role: "participant", barangay: "" });
    setShowAddModal(false);
    setSuccessMsg("User added successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleToggleStatus = (id) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "Active" ? "Inactive" : "Active" }
          : u
      )
    );
    setSuccessMsg("User status updated!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleDelete = (id) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setSuccessMsg("User deleted.");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleEditRole = (e) => {
    e.preventDefault();
    setUsers((prev) =>
      prev.map((u) =>
        u.id === selectedUser.id
          ? { ...u, role: form.role }
          : u
      )
    );
    setShowEditModal(false);
    setSuccessMsg("User role updated!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div style={{ padding: "32px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
            Manage Users
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            View, manage, and control user accounts and roles.
          </p>
        </div>
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
          <FiPlus size={14} /> Add User
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

      {/* Summary Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "16px", marginBottom: "24px"
      }}>
        {[
          { label: "Total Users", value: users.length, icon: "👥" },
          { label: "Admins", value: users.filter(u => u.role === "admin").length, icon: "🔑" },
          { label: "Staff", value: users.filter(u => u.role === "staff").length, icon: "👨‍💼" },
          { label: "Participants", value: users.filter(u => u.role === "participant").length, icon: "🌱" },
          { label: "Active", value: users.filter(u => u.status === "Active").length, icon: "✅" },
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

      {/* Search and Filter */}
      <div style={{
        display: "flex", gap: "12px",
        marginBottom: "16px"
      }}>
        <div style={{ position: "relative", flex: 1 }}>
          <FiSearch size={14} style={{
            position: "absolute", left: "12px",
            top: "50%", transform: "translateY(-50%)",
            color: "#9ca3af"
          }} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px 10px 34px",
              border: "1px solid #e5e7eb", borderRadius: "8px",
              fontSize: "13px", boxSizing: "border-box"
            }}
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{
            padding: "10px 14px",
            border: "1px solid #e5e7eb", borderRadius: "8px",
            fontSize: "13px", background: "#fff", color: "#374151"
          }}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="participant">Participant</option>
        </select>
      </div>

      {/* Users Table */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: "12px", overflow: "hidden"
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a" }}>
            All Users
          </h2>
          <span style={{ fontSize: "13px", color: "#6b7280" }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["User", "Contact", "Role", "Barangay", "Status", "Actions"].map((h) => (
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
            {filtered.map((user, i) => (
              <tr key={user.id} style={{
                borderTop: "1px solid #f3f4f6",
                background: i % 2 === 0 ? "#fff" : "#fafafa"
              }}>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "34px", height: "34px",
                      borderRadius: "50%", background: "#16a34a",
                      display: "flex", alignItems: "center",
                      justifyContent: "center", color: "#fff",
                      fontSize: "13px", fontWeight: "700",
                      flexShrink: 0
                    }}>
                      {user.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>
                        {user.fullName}
                      </div>
                      <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {user.contact}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: "999px",
                    fontSize: "12px", fontWeight: "600",
                    background: ROLE_COLORS[user.role]?.bg,
                    color: ROLE_COLORS[user.role]?.color,
                    textTransform: "capitalize"
                  }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                  {user.barangay}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: "999px",
                    fontSize: "12px", fontWeight: "600",
                    background: STATUS_COLORS[user.status]?.bg,
                    color: STATUS_COLORS[user.status]?.color,
                  }}>
                    {user.status}
                  </span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setForm({ ...form, role: user.role });
                        setShowEditModal(true);
                      }}
                      style={{
                        padding: "6px 10px",
                        background: "#dbeafe", color: "#1e40af",
                        border: "none", borderRadius: "6px",
                        fontSize: "12px", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "4px"
                      }}
                    >
                      <FiEdit2 size={11} /> Role
                    </button>
                    <button
                      onClick={() => handleToggleStatus(user.id)}
                      style={{
                        padding: "6px 10px",
                        background: user.status === "Active" ? "#fef9c3" : "#dcfce7",
                        color: user.status === "Active" ? "#854d0e" : "#166534",
                        border: "none", borderRadius: "6px",
                        fontSize: "12px", cursor: "pointer",
                      }}
                    >
                      {user.status === "Active" ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      style={{
                        padding: "6px 10px",
                        background: "#fee2e2", color: "#991b1b",
                        border: "none", borderRadius: "6px",
                        fontSize: "12px", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "4px"
                      }}
                    >
                      <FiTrash2 size={11} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
            No users found.
          </div>
        )}
      </div>

      {/* Add User Modal */}
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
              Add New User
            </h2>
            <form onSubmit={handleAdd}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Full Name *
                  </label>
                  <input type="text" placeholder="Juan Dela Cruz"
                    value={form.fullName} onChange={update("fullName")}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Email *
                  </label>
                  <input type="email" placeholder="juan@example.com"
                    value={form.email} onChange={update("email")}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Contact Number
                  </label>
                  <input type="text" placeholder="09123456789"
                    value={form.contact} onChange={update("contact")}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Role
                  </label>
                  <select value={form.role} onChange={update("role")}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", background: "#fff" }}
                  >
                    <option value="participant">Participant</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                    Barangay
                  </label>
                  <input type="text" placeholder="e.g. Barangay Tughan"
                    value={form.barangay} onChange={update("barangay")}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowAddModal(false)}
                  style={{ padding: "10px 18px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", background: "#fff", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button type="submit"
                  style={{ padding: "10px 18px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && selectedUser && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "#fff", borderRadius: "16px",
            padding: "28px", width: "360px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)"
          }}>
            <h2 style={{ fontSize: "17px", fontWeight: "700", marginBottom: "6px" }}>
              Edit User Role
            </h2>
            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "20px" }}>
              {selectedUser.fullName}
            </p>
            <form onSubmit={handleEditRole}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                  Role
                </label>
                <select value={form.role} onChange={update("role")}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", background: "#fff" }}
                >
                  <option value="participant">Participant</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowEditModal(false)}
                  style={{ padding: "10px 18px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px", background: "#fff", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button type="submit"
                  style={{ padding: "10px 18px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}