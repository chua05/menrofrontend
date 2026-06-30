import { FiBell, FiSettings } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";

export default function Topbar() {
  const { currentUser, userRole } = useAuth();

  const initials = currentUser?.fullname
    ? currentUser.fullname.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
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
        <input
          type="text"
          placeholder="Search reports, seedlings, or IDs..."
        />
      </div>

      {/* Right side */}
      <div className="topbar-right">

        {/* Notifications */}
        <div className="topbar-icon-btn">
          <FiBell size={15} />
          <div className="topbar-notif-dot" />
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
              {currentUser?.fullname || "User"}
            </div>
            <div className="topbar-user-role">
              {userRole === "admin" ? "Office Head"
                : userRole === "staff" ? "Office Member"
                : "Volunteer"}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}