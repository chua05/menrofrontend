import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FiLayout, FiUsers, FiPackage, FiClipboard,
  FiMap, FiCalendar, FiCheckSquare, FiFileText,
  FiUpload, FiLogOut
} from "react-icons/fi";

// Nav config per role
const NAV = {
  admin: [
    {
      section: "Main",
      items: [
        { label: "Dashboard", icon: <FiLayout size={15} />, to: "/admin/dashboard" },
      ]
    },
    {
      section: "Management",
      items: [
        { label: "Manage Users", icon: <FiUsers size={15} />, to: "/admin/users" },
        { label: "Seedling Requests", icon: <FiClipboard size={15} />, to: "/admin/requests" },
        { label: "Process Requests", icon: <FiCheckSquare size={15} />, to: "/admin/process-requests" },
      ]
    },
    {
      section: "Planting",
      items: [
        { label: "Planting Events", icon: <FiCalendar size={15} />, to: "/admin/events" },
        { label: "Event Schedule", icon: <FiCalendar size={15} />, to: "/admin/schedule" },
        { label: "Planting Map", icon: <FiMap size={15} />, to: "/admin/map" },
      ]
    },
    {
      section: "Monitoring",
      items: [
        { label: "Submit Report", icon: <FiUpload size={15} />, to: "/admin/submit-report" },
        { label: "Verify Reports", icon: <FiCheckSquare size={15} />, to: "/admin/verify-reports" },
        { label: "Tree Monitoring", icon: <FiFileText size={15} />, to: "/admin/monitoring" },
      ]
    },
    {
      section: "Reports",
      items: [
        { label: "Reports", icon: <FiFileText size={15} />, to: "/admin/reports" },
      ]
    },
  ],

  staff: [
    {
      section: "Main",
      items: [
        { label: "Dashboard", icon: <FiLayout size={15} />, to: "/staff/dashboard" },
      ]
    },
    {
      section: "Seedlings",
      items: [
        { label: "Manage Seedlings", icon: <FiPackage size={15} />, to: "/staff/seedlings" },
        { label: "Process Requests", icon: <FiCheckSquare size={15} />, to: "/staff/process-requests" },
      ]
    },
    {
      section: "Planting",
      items: [
        { label: "Planting Events", icon: <FiCalendar size={15} />, to: "/staff/events" },
        { label: "Event Schedule", icon: <FiCalendar size={15} />, to: "/staff/schedule" },
        { label: "Planting Map", icon: <FiMap size={15} />, to: "/staff/map" },
      ]
    },
    {
      section: "Monitoring",
      items: [
        { label: "Submit Report", icon: <FiUpload size={15} />, to: "/staff/submit-report" },
        { label: "Verify Reports", icon: <FiCheckSquare size={15} />, to: "/staff/verify-reports" },
        { label: "Tree Monitoring", icon: <FiFileText size={15} />, to: "/staff/monitoring" },
      ]
    },
    {
      section: "Reports",
      items: [
        { label: "Reports", icon: <FiFileText size={15} />, to: "/staff/reports" },
      ]
    },
  ],

  volunteer: [
    {
      section: "Main",
      items: [
        { label: "Overview", icon: <FiLayout size={15} />, to: "/volunteer/dashboard" },
      ]
    },
    {
      section: "Seedlings",
      items: [
        { label: "Submit Request", icon: <FiClipboard size={15} />, to: "/volunteer/requests" },
      ]
    },
    {
      section: "Planting",
      items: [
        { label: "Event Schedule", icon: <FiCalendar size={15} />, to: "/volunteer/schedule" },
        { label: "Planting Sites", icon: <FiMap size={15} />, to: "/volunteer/map" },
        { label: "Submit Report", icon: <FiUpload size={15} />, to: "/volunteer/submit-report" },
      ]
    },
    {
      section: "Monitoring",
      items: [
        { label: "Tree Monitoring", icon: <FiFileText size={15} />, to: "/volunteer/monitoring" },
      ]
    },
    {
      section: "Reports",
      items: [
        { label: "Reports", icon: <FiFileText size={15} />, to: "/volunteer/reports" },
      ]
    },
  ],
};

export default function Sidebar() {
  const { userRole, currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = NAV[userRole] || NAV.staff;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Get initials for avatar
  const initials = currentUser?.name
    ? currentUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <div className="sidebar">

      {/* Logo */}
      <div className="sb-logo">
        <div className="sb-logo-mark">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
          </svg>
        </div>
        <div>
          <div className="sb-logo-name">MENRO</div>
          <div className="sb-logo-sub">ENVIRONMENT OFFICE</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sb-nav">
        {navItems.map((group) => (
          <div key={group.section}>
            <div className="sb-section">{group.section}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sb-item ${isActive ? "active" : ""}`
                }
              >
                <span className="sb-item-icon">{item.icon}</span>
                <span className="sb-item-label">{item.label}</span>
                {item.badge && (
                  <span className="sb-badge">{item.badge}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom user + logout */}
      <div className="sb-bottom">
        <div className="sb-user">
          <div className="sb-avatar">{initials}</div>
          <div>
            <div className="sb-user-name">
              {currentUser?.name || "User"}
            </div>
            <div className="sb-user-role">
              {userRole === "admin" ? "Administrator"
                : userRole === "staff" ? "Office Member"
                : "Volunteer"}
            </div>
          </div>
        </div>
        <div className="sb-logout" onClick={handleLogout}>
          <span className="sb-logout-icon"><FiLogOut size={14} /></span>
          <span className="sb-logout-label">Logout</span>
        </div>
      </div>

    </div>
  );
}