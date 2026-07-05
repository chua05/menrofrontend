import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FiLayout, FiUsers, FiPackage, FiClipboard,
  FiMap, FiCalendar, FiCheckSquare, FiFileText,
<<<<<<< HEAD
  FiUpload, FiLogOut
} from "react-icons/fi";

// Nav config per role
=======
  FiUpload, FiLogOut, FiSettings, FiUser,
  FiMapPin, FiActivity
} from "react-icons/fi";

>>>>>>> origin/rebuild-frontend
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
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/rebuild-frontend
  ],

  staff: [
    {
      section: "Main",
      items: [
        { label: "Dashboard", icon: <FiLayout size={15} />, to: "/staff/dashboard" },
      ]
    },
    {
<<<<<<< HEAD
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
=======
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

  participant: [
    {
      section: "Main",
      items: [
        { label: "Dashboard", icon: <FiLayout size={15} />, to: "/participant/dashboard" },
>>>>>>> origin/rebuild-frontend
      ]
    },
    {
      section: "Seedlings",
      items: [
<<<<<<< HEAD
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
=======
        { label: "Request Seedlings", icon: <FiClipboard size={15} />, to: "/participant/request-seedlings" },
        { label: "My Requests", icon: <FiFileText size={15} />, to: "/participant/my-requests" },
      ]
    },
    {
      section: "Activities",
      items: [
        { label: "Events", icon: <FiCalendar size={15} />, to: "/participant/events" },
        { label: "My Sites", icon: <FiMapPin size={15} />, to: "/participant/my-sites" },
        { label: "My Activities", icon: <FiActivity size={15} />, to: "/participant/my-activities" },
        { label: "Monitoring", icon: <FiCheckSquare size={15} />, to: "/participant/monitoring" },
      ]
    },
    {
      section: "Account",
      items: [
        { label: "Profile", icon: <FiUser size={15} />, to: "/participant/profile" },
>>>>>>> origin/rebuild-frontend
      ]
    },
  ],
};

export default function Sidebar() {
  const { userRole, currentUser, logout } = useAuth();
  const navigate = useNavigate();
<<<<<<< HEAD
  const navItems = NAV[userRole] || NAV.staff;
=======
  const navItems = NAV[userRole] || NAV.participant;
>>>>>>> origin/rebuild-frontend

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

<<<<<<< HEAD
  // Get initials for avatar
  const initials = currentUser?.fullname
    ? currentUser.fullname.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
=======
  const initials = currentUser?.fullName
    ? currentUser.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
>>>>>>> origin/rebuild-frontend
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
<<<<<<< HEAD
                {item.badge && (
                  <span className="sb-badge">{item.badge}</span>
                )}
=======
>>>>>>> origin/rebuild-frontend
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
<<<<<<< HEAD
              {currentUser?.fullname || "User"}
=======
              {currentUser?.fullName || "User"}
>>>>>>> origin/rebuild-frontend
            </div>
            <div className="sb-user-role">
              {userRole === "admin" ? "Administrator"
                : userRole === "staff" ? "Office Member"
<<<<<<< HEAD
                : "Volunteer"}
=======
                : "participant"}
>>>>>>> origin/rebuild-frontend
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