import { useState } from "react";
import { FiSave, FiSettings, FiShield, FiMapPin, FiBell } from "react-icons/fi";

export default function SettingsPage() {
  const [successMsg, setSuccessMsg] = useState("");
  const [settings, setSettings] = useState({
    systemName: "MENRO Geo-Tagged Reforestation Monitoring System",
    municipality: "Juban, Sorsogon",
    gpsToleranceRadius: "20",
    maxMonitoringYears: "2",
    allowDuplicateDetection: true,
    allowTimestampValidation: true,
    allowGPSValidation: true,
    emailNotifications: true,
    lowStockThreshold: "10",
  });

  const update = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSuccessMsg("Settings saved successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div style={{ padding: "32px", maxWidth: "700px" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>
          System Settings
        </h1>
        <p style={{ color: "#6b7280", fontSize: "14px" }}>
          Configure system preferences and operational parameters.
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

      <form onSubmit={handleSave}>

        {/* General Settings */}
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: "16px", padding: "24px", marginBottom: "16px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <FiSettings size={16} color="#16a34a" />
            <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a", margin: 0 }}>
              General Settings
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                System Name
              </label>
              <input
                type="text"
                value={settings.systemName}
                onChange={update("systemName")}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1px solid #e5e7eb", borderRadius: "8px",
                  fontSize: "13px", boxSizing: "border-box"
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                Municipality
              </label>
              <input
                type="text"
                value={settings.municipality}
                onChange={update("municipality")}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1px solid #e5e7eb", borderRadius: "8px",
                  fontSize: "13px", boxSizing: "border-box"
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                Low Stock Alert Threshold (units)
              </label>
              <input
                type="number"
                min="1"
                value={settings.lowStockThreshold}
                onChange={update("lowStockThreshold")}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1px solid #e5e7eb", borderRadius: "8px",
                  fontSize: "13px", boxSizing: "border-box"
                }}
              />
            </div>
          </div>
        </div>

        {/* Geo-Tagging Settings */}
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: "16px", padding: "24px", marginBottom: "16px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <FiMapPin size={16} color="#16a34a" />
            <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a", margin: 0 }}>
              Geo-Tagging Settings
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                GPS Tolerance Radius (meters)
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={settings.gpsToleranceRadius}
                onChange={update("gpsToleranceRadius")}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1px solid #e5e7eb", borderRadius: "8px",
                  fontSize: "13px", boxSizing: "border-box"
                }}
              />
              <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                Per manuscript spec: 5–20 meters recommended tolerance.
              </p>
            </div>
            <div>
              <label style={{ fontSize: "13px", fontWeight: "500", display: "block", marginBottom: "6px" }}>
                Maximum Monitoring Period (years)
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={settings.maxMonitoringYears}
                onChange={update("maxMonitoringYears")}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1px solid #e5e7eb", borderRadius: "8px",
                  fontSize: "13px", boxSizing: "border-box"
                }}
              />
            </div>
          </div>
        </div>

        {/* Verification Settings */}
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: "16px", padding: "24px", marginBottom: "16px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <FiShield size={16} color="#16a34a" />
            <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a", margin: 0 }}>
              Verification Settings
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[
              { label: "Enable Duplicate Image Detection", field: "allowDuplicateDetection", description: "Detect and flag reused or duplicate photo submissions." },
              { label: "Enable Timestamp Validation", field: "allowTimestampValidation", description: "Validate timestamps of submitted planting reports." },
              { label: "Enable GPS Coordinate Validation", field: "allowGPSValidation", description: "Validate GPS coordinates against designated planting sites." },
            ].map((item) => (
              <div key={item.field} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", gap: "16px",
                padding: "14px", background: "#f9fafb",
                borderRadius: "10px"
              }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a1a1a", marginBottom: "2px" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    {item.description}
                  </div>
                </div>
                <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px", flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={settings[item.field]}
                    onChange={update(item.field)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: "absolute", cursor: "pointer",
                    inset: 0, borderRadius: "999px",
                    background: settings[item.field] ? "#16a34a" : "#e5e7eb",
                    transition: "0.2s"
                  }}>
                    <span style={{
                      position: "absolute",
                      width: "18px", height: "18px",
                      borderRadius: "50%", background: "#fff",
                      top: "3px",
                      left: settings[item.field] ? "23px" : "3px",
                      transition: "0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                    }} />
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Notification Settings */}
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: "16px", padding: "24px", marginBottom: "24px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <FiBell size={16} color="#16a34a" />
            <h2 style={{ fontSize: "15px", fontWeight: "600", color: "#1a1a1a", margin: 0 }}>
              Notification Settings
            </h2>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", gap: "16px",
            padding: "14px", background: "#f9fafb",
            borderRadius: "10px"
          }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a1a1a", marginBottom: "2px" }}>
                Email Notifications
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                Send email alerts for approvals, rejections, and system updates.
              </div>
            </div>
            <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px", flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={update("emailNotifications")}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: "absolute", cursor: "pointer",
                inset: 0, borderRadius: "999px",
                background: settings.emailNotifications ? "#16a34a" : "#e5e7eb",
                transition: "0.2s"
              }}>
                <span style={{
                  position: "absolute",
                  width: "18px", height: "18px",
                  borderRadius: "50%", background: "#fff",
                  top: "3px",
                  left: settings.emailNotifications ? "23px" : "3px",
                  transition: "0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            style={{
              padding: "12px 24px", background: "#16a34a",
              color: "#fff", border: "none", borderRadius: "8px",
              fontSize: "14px", fontWeight: "600", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "8px"
            }}
          >
            <FiSave size={15} /> Save Settings
          </button>
        </div>

      </form>
    </div>
  );
}