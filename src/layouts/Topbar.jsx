import { useState, useRef, useEffect } from "react";
import { FiBell, FiSettings } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";

const SAMPLE_NOTIFICATIONS = {
  alerts: [
    { id: 1, message: "New seedling request submitted by Juan Dela Cruz.", time: "2 mins ago", read: false },
    { id: 2, message: "REQ-002 has been approved by the Administrator.", time: "1 hour ago", read: false },
    { id: 3, message: "Low stock alert: Mahogany seedlings (8 remaining).", time: "3 hours ago", read: true },
  ],
  events: [
    { id: 4, message: "Juban Reforestation Drive is scheduled on July 15, 2026.", time: "Yesterday", read: false },
    { id: 5, message: "Coastal Mangrove Planting event is now full.", time: "2 days ago", read: true },
  ],
  logs: [
    { id: 6, message: "Admin approved PLT-001 planting report.", time: "July 1, 2026", read: true },
    { id: 7, message: "Staff marked REQ-003 as Reviewed.", time: "July 2, 2026", read: true },
  ],
};

export default function Topbar() {
  const { currentUser, userRole } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const [activeTab, setActiveTab] = useState("alerts");
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);
  const notifRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = [
    ...notifications.alerts,
    ...notifications.events,
    ...notifications.logs,
  ].filter(n => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications({
      alerts: notifications.alerts.map(n => ({ ...n, read: true })),
      events: notifications.events.map(n => ({ ...n, read: true })),
      logs: notifications.logs.map(n => ({ ...n, read: true })),
    });
  };

  const handleMarkRead = (tab, id) => {
    setNotifications((prev) => ({
      ...prev,
      [tab]: prev[tab].map(n => n.id === id ? { ...n, read: true } : n),
    }));
  };

  const currentList = notifications[activeTab];
  const unreadTab = notifications[activeTab].filter(n => !n.read).length;

  const initials = currentUser?.fullName
    ? currentUser.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <div className="topbar">

      {/* Search */}
      <div className="topbar-search">
        <span className="topbar-search-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </span>
        <input type="text" placeholder="Search reports, seedlings, or IDs..." />
      </div>

      {/* Right side */}
      <div className="topbar-right">

        {/* Notifications */}
        <div style={{ position: "relative" }} ref={notifRef}>
          <div
            className="topbar-icon-btn"
            onClick={() => setShowNotif(!showNotif)}
            style={{ cursor: "pointer" }}
          >
            <FiBell size={15} />
            {unreadCount > 0 && (
              <div className="topbar-notif-dot" style={{
                position: "absolute", top: "-2px", right: "-2px",
                background: "#ef4444", color: "#fff",
                borderRadius: "999px", fontSize: "10px",
                fontWeight: "700", minWidth: "16px", height: "16px",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 3px"
              }}>
                {unreadCount}
              </div>
            )}
          </div>

          {/* Notification Dropdown */}
          {showNotif && (
            <div style={{
              position: "absolute", right: 0, top: "44px",
              width: "340px", background: "#fff",
              borderRadius: "14px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
              border: "1px solid #e5e7eb", zIndex: 9999,
              overflow: "hidden"
            }}>
              {/* Header */}
              <div style={{
                background: "#16a34a", padding: "16px 18px 0",
              }}>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#fff", marginBottom: "12px" }}>
                  Notifications
                </div>
                {/* Tabs */}
                <div style={{ display: "flex", gap: "4px" }}>
                  {["alerts", "events", "logs"].map((tab) => {
                    const count = notifications[tab].filter(n => !n.read).length;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                          padding: "8px 14px",
                          background: activeTab === tab ? "#fff" : "transparent",
                          color: activeTab === tab ? "#16a34a" : "#fff",
                          border: "none", borderRadius: "8px 8px 0 0",
                          fontSize: "13px", fontWeight: "600",
                          cursor: "pointer", textTransform: "capitalize",
                          display: "flex", alignItems: "center", gap: "6px"
                        }}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {count > 0 && (
                          <span style={{
                            background: activeTab === tab ? "#16a34a" : "rgba(255,255,255,0.3)",
                            color: "#fff", borderRadius: "999px",
                            fontSize: "10px", fontWeight: "700",
                            padding: "1px 6px"
                          }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notification List */}
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {currentList.length === 0 ? (
                  <div style={{
                    padding: "40px 20px", textAlign: "center",
                    color: "#9ca3af"
                  }}>
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>🎉</div>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>All caught up!</div>
                    <div style={{ fontSize: "13px", marginTop: "4px" }}>No new notifications.</div>
                  </div>
                ) : (
                  currentList.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleMarkRead(activeTab, notif.id)}
                      style={{
                        padding: "14px 18px",
                        borderBottom: "1px solid #f3f4f6",
                        background: notif.read ? "#fff" : "#f0fdf4",
                        cursor: "pointer",
                        display: "flex", gap: "12px", alignItems: "flex-start",
                        transition: "background 0.2s"
                      }}
                    >
                      <div style={{
                        width: "8px", height: "8px",
                        borderRadius: "50%",
                        background: notif.read ? "transparent" : "#16a34a",
                        marginTop: "5px", flexShrink: 0
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: "13px", color: "#374151",
                          lineHeight: "1.4",
                          fontWeight: notif.read ? "400" : "500"
                        }}>
                          {notif.message}
                        </div>
                        <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                          {notif.time}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: "12px 18px",
                borderTop: "1px solid #f3f4f6",
                display: "flex", justifyContent: "space-between",
                alignItems: "center"
              }}>
                <button
                  onClick={() => setShowNotif(false)}
                  style={{
                    fontSize: "13px", color: "#16a34a",
                    background: "none", border: "none",
                    cursor: "pointer", fontWeight: "600"
                  }}
                >
                  
                </button>
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    fontSize: "13px", color: "#6b7280",
                    background: "none", border: "none",
                    cursor: "pointer", fontWeight: "500"
                  }}
                >
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="topbar-icon-btn">
          <FiSettings size={15} />
        </div>

        {/* User info */}
        <div className="topbar-user">
          <div className="topbar-avatar">{initials}</div>
          <div>
            <div className="topbar-user-name">
              {currentUser?.fullName || "User"}
            </div>
            <div className="topbar-user-role">
              {userRole === "admin" ? "Office Head"
                : userRole === "staff" ? "Office Member"
                : "Participant"}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}