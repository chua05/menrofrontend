import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FiUser, FiMail, FiPhone, FiMapPin, FiEdit2, FiSave } from "react-icons/fi";

export default function ProfilePage() {
  const { currentUser, userRole } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    fullName: currentUser?.fullName || "Test User",
    email: currentUser?.email || "user@menro.gov.ph",
    contact: currentUser?.contact || "09123456789",
    barangay: currentUser?.barangay || "Juban Proper",
    organization: currentUser?.organization || "MENRO Juban",
  });

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = (e) => {
    e.preventDefault();
    setIsEditing(false);
    setSuccessMsg("Profile updated successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const initials = form.fullName
    .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ padding: "32px", maxWidth: "700px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
          My Profile
        </h1>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          View and update your account information.
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

      {/* Profile Card */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: "16px", overflow: "hidden",
        marginBottom: "20px"
      }}>
        {/* Cover */}
        <div style={{
          background: "linear-gradient(135deg, #16a34a, #15803d)",
          height: "100px"
        }} />

        {/* Avatar + Info */}
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{
              width: "72px", height: "72px",
              borderRadius: "50%", background: "#fff",
              border: "4px solid #fff",
              display: "flex", alignItems: "center",
              justifyContent: "center",
              marginTop: "-36px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
            }}>
              <div style={{
                width: "64px", height: "64px",
                borderRadius: "50%", background: "#16a34a",
                display: "flex", alignItems: "center",
                justifyContent: "center", color: "#fff",
                fontSize: "22px", fontWeight: "700"
              }}>
                {initials}
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              style={{
                padding: "8px 16px",
                background: isEditing ? "#fee2e2" : "#f3f4f6",
                color: isEditing ? "#991b1b" : "#374151",
                border: "none", borderRadius: "8px",
                fontSize: "13px", fontWeight: "600",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px"
              }}
            >
              <FiEdit2 size={13} />
              {isEditing ? "Cancel" : "Edit Profile"}
            </button>
          </div>

          <div style={{ marginTop: "12px" }}>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#1a1a1a" }}>
              {form.fullName}
            </div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
              <span style={{
                padding: "2px 10px", borderRadius: "999px",
                fontSize: "12px", fontWeight: "600",
                background: userRole === "admin" ? "#ede9fe" : userRole === "staff" ? "#dbeafe" : "#dcfce7",
                color: userRole === "admin" ? "#6d28d9" : userRole === "staff" ? "#1e40af" : "#166534",
                textTransform: "capitalize"
              }}>
                {userRole === "admin" ? "Administrator" : userRole === "staff" ? "Office Member" : "Participant"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: "16px", padding: "24px"
      }}>
        <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a", marginBottom: "20px" }}>
          Account Information
        </h2>

        <form onSubmit={handleSave}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {[
              { label: "Full Name", field: "fullName", icon: <FiUser size={14} />, type: "text" },
              { label: "Email Address", field: "email", icon: <FiMail size={14} />, type: "email" },
              { label: "Contact Number", field: "contact", icon: <FiPhone size={14} />, type: "text" },
              { label: "Barangay", field: "barangay", icon: <FiMapPin size={14} />, type: "text" },
              { label: "Organization", field: "organization", icon: <FiUser size={14} />, type: "text" },
            ].map((item) => (
              <div key={item.field}>
                <label style={{ fontSize: "13px", fontWeight: "500", color: "#374151", display: "block", marginBottom: "6px" }}>
                  {item.label}
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute", left: "12px",
                    top: "50%", transform: "translateY(-50%)",
                    color: "#9ca3af"
                  }}>
                    {item.icon}
                  </span>
                  <input
                    type={item.type}
                    value={form[item.field]}
                    onChange={update(item.field)}
                    disabled={!isEditing}
                    style={{
                      width: "100%", padding: "10px 12px 10px 36px",
                      border: "1px solid #e5e7eb", borderRadius: "8px",
                      fontSize: "13px", boxSizing: "border-box",
                      background: isEditing ? "#fff" : "#f9fafb",
                      color: "#374151",
                      cursor: isEditing ? "text" : "default"
                    }}
                  />
                </div>
              </div>
            ))}

          </div>

          {isEditing && (
            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                style={{
                  padding: "10px 20px", background: "#16a34a",
                  color: "#fff", border: "none", borderRadius: "8px",
                  fontSize: "13px", fontWeight: "600", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "6px"
                }}
              >
                <FiSave size={14} /> Save Changes
              </button>
            </div>
          )}
        </form>
      </div>

    </div>
  );
}