import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FiLayout, FiUsers, FiPackage, FiClipboard,
  FiMap, FiCalendar, FiCheckSquare, FiFileText,
  FiUpload, FiLogOut, FiSettings, FiUser,
  FiMapPin, FiActivity
} from "react-icons/fi";

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
        { label: "Sites", icon: <FiMapPin size={15} />, to: "/admin/sites" },
        { label: "Events", icon: <FiCalendar size={15} />, to: "/admin/events" },
        { label: "Seedling Requests", icon: <FiClipboard size={15} />, to: "/admin/requests" },
        { label: "Seedlings", icon: <FiPackage size={15} />, to: "/admin/seedlings" },
        { label: "Planting", icon: <FiUpload size={15} />, to: "/admin/planting" },
        { label: "Monitoring", icon: <FiCheckSquare size={15} />, to: "/admin/monitoring" },
        { label: "Users", icon: <FiUsers size={15} />, to: "/admin/users" },
        { label: "Reports", icon: <FiFileText size={15} />, to: "/admin/reports" },
      ]
    },
    {
      section: "Account",
      items: [
        { label: "Settings", icon: <FiSettings size={15} />, to: "/admin/settings" },
        { label: "Profile", icon: <FiUser size={15} />, to: "/admin/profile" },
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
      section: "Management",
      items: [
        { label: "Sites", icon: <FiMapPin size={15} />, to: "/staff/sites" },
        { label: "Events", icon: <FiCalendar size={15} />, to: "/staff/events" },
        { label: "Seedling Requests", icon: <FiClipboard size={15} />, to: "/staff/requests" },
        { label: "Seedlings", icon: <FiPackage size={15} />, to: "/staff/seedlings" },
        { label: "Planting", icon: <FiUpload size={15} />, to: "/staff/planting" },
        { label: "Monitoring", icon: <FiCheckSquare size={15} />, to: "/staff/monitoring" },
        { label: "Reports", icon: <FiFileText size={15} />, to: "/staff/reports" },
      ]
    },
    {
      section: "Account",
      items: [
        { label: "Profile", icon: <FiUser size={15} />, to: "/staff/profile" },
      ]
    },
  ],

  volunteer: [
    {
      section: "Main",
      items: [
        { label: "Dashboard", icon: <FiLayout size={15} />, to: "/volunteer/dashboard" },
      ]
    },
    {
      section: "Seedlings",
      items: [
        { label: "Request Seedlings", icon: <FiClipboard size={15} />, to: "/volunteer/request-seedlings" },
        { label: "My Requests", icon: <FiFileText size={15} />, to: "/volunteer/my-requests" },
      ]
    },
    {
      section: "Activities",
      items: [
        { label: "Events", icon: <FiCalendar size={15} />, to: "/volunteer/events" },
        { label: "My Sites", icon: <FiMapPin size={15} />, to: "/volunteer/my-sites" },
        { label: "My Activities", icon: <FiActivity size={15} />, to: "/volunteer/my-activities" },
        { label: "Monitoring", icon: <FiCheckSquare size={15} />, to: "/volunteer/monitoring" },
      ]
    },
    {
      section: "Account",
      items: [
        { label: "Profile", icon: <FiUser size={15} />, to: "/volunteer/profile" },
      ]
    },
  ],
};

export default function Sidebar() {
  const { userRole, currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = NAV[userRole] || NAV.volunteer;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = currentUser?.fullName
    ? currentUser.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
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
              {currentUser?.fullName || "User"}
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