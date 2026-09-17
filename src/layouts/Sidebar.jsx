import { NavLink, useNavigate } from "react-router-dom";
import {useState,} from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Sprout,
  CalendarDays,
  MapPin,
  FileCheck2,
  Activity,
  ChartNoAxesCombined,
  Map,
  FileText,
  Users,
  Settings,
  UserRound,
  LogOut,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import menroLogo from "../assets/menro-logo.png";

const NAVIGATION = {
  admin: [
    {
      section: "Main",
      items: [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          to: "/admin/dashboard",
        },
      ],
    },
    {
      section: "Management",
      items: [
        {
          label: "Seedling Requests",
          icon: ClipboardList,
          to: "/admin/requests",
        },
        {
          label: "Seedlings",
          icon: Sprout,
          to: "/admin/seedlings",
        },
        {
          label: "Event Calendar",
          icon: CalendarDays,
          to: "/admin/event-calendar",
        },
        {
          label: "Planting Sites",
          icon: MapPin,
          to: "/admin/planting-sites",
        },
      ],
    },
    {
      section: "Monitoring",
      items: [
        {
          label: "Planting Reports",
          icon: FileCheck2,
          to: "/admin/planting-reports",
        },
        {
          label: "Survival Monitoring",
          icon: Activity,
          to: "/admin/survival-monitoring",
        },
      ],
    },
    {
      section: "Analytics",
      items: [
        {
          label: "Reforestation Analytics",
          icon: ChartNoAxesCombined,
          to: "/admin/reforestation-analytics",
        },
        {
          label: "Map Visualization",
          icon: Map,
          to: "/admin/map-visualization",
        },
      ],
    },
    {
      section: "System",
      items: [
        {
          label: "Reports",
          icon: FileText,
          to: "/admin/reports",
        },
        {
          label: "Registered Users",
          icon: Users,
          to: "/admin/registered-users",
        },
        {
          label: "Settings",
          icon: Settings,
          to: "/admin/settings",
        },
      ],
    },
  ],

  staff: [
    {
      section: "Main",
      items: [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          to: "/staff/dashboard",
        },
      ],
    },
    {
      section: "Management",
      items: [
        {
          label: "Seedling Requests",
          icon: ClipboardList,
          to: "/staff/requests",
        },
        {
          label: "Seedlings",
          icon: Sprout,
          to: "/staff/seedlings",
        },
        {
          label: "Event Calendar",
          icon: CalendarDays,
          to: "/staff/event-calendar",
        },
        {
          label: "Planting Sites",
          icon: MapPin,
          to: "/staff/planting-sites",
        },
      ],
    },
    {
      section: "Monitoring",
      items: [
        {
          label: "Planting Reports",
          icon: FileCheck2,
          to: "/staff/planting-reports",
        },
        {
          label: "Survival Monitoring",
          icon: Activity,
          to: "/staff/survival-monitoring",
        },
      ],
    },
    {
      section: "Analytics",
      items: [
        {
          label: "Reforestation Analytics",
          icon: ChartNoAxesCombined,
          to: "/staff/reforestation-analytics",
        },
        {
          label: "Map Visualization",
          icon: Map,
          to: "/staff/map-visualization",
        },
      ],
    },
    {
      section: "System",
      items: [
        {
          label: "Reports",
          icon: FileText,
          to: "/staff/reports",
        },
        {
          label: "Registered Users",
          icon: Users,
          to: "/staff/registered-users",
        },
        {
          label: "Settings",
          icon: Settings,
          to: "/staff/settings",
        },
      ],
    },
  ],

  participant: [
    {
      section: "Main",
      items: [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          to: "/participant/dashboard",
        },
      ],
    },
    {
      section: "Seedlings",
      items: [
        {
          label: "Request Seedlings",
          icon: Sprout,
          to: "/participant/request-seedlings",
        },
        {
          label: "My Requests",
          icon: ClipboardList,
          to: "/participant/my-requests",
        },
      ],
    },
    {
      section: "Activities",
      items: [
        {
          label: "Event Calendar",
          icon: CalendarDays,
          to: "/participant/event-calendar",
        },
        {
          label: "Planting Sites",
          icon: MapPin,
          to: "/participant/planting-sites",
        },
      ],
    },
    {
      section: "Monitoring",
      items: [
        {
          label: "My Planting Reports",
          icon: FileCheck2,
          to: "/participant/my-planting-reports",
        },
        {
          label: "Survival Monitoring",
          icon: Activity,
          to: "/participant/survival-monitoring",
        },
      ],
    },
    {
      section: "Account",
      items: [
        {
          label: "Profile",
          icon: UserRound,
          to: "/participant/profile",
        },
      ],
    },
  ],
};

function getRoleLabel(role) {
  if (role === "admin") return "Office Head";
  if (role === "staff") return "Staff";
  return "Participant";
}

function getFallbackName(role) {
  if (role === "admin") return "MENRO Administrator";
  if (role === "staff") return "MENRO Staff";
  return "Participant";
}

function getInitials(name, role) {
  if (!name) {
    if (role === "admin") return "MA";
    if (role === "staff") return "MS";
    return "P";
  }

  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Sidebar({ isOpen, onClose }) {
  const { userRole, currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [
    showLogoutConfirm,
    setShowLogoutConfirm,
  ] = useState(false);

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  const resolvedRole =
    userRole && NAVIGATION[userRole] ? userRole : "participant";

  const navigation = NAVIGATION[resolvedRole];

  const displayName =
    currentUser?.fullName?.trim() || getFallbackName(resolvedRole);

  const roleLabel = getRoleLabel(resolvedRole);

  const initials = getInitials(displayName, resolvedRole);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await logout();

      setShowLogoutConfirm(false);

      onClose?.();

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Logout failed:",
        error
      );

      setLoggingOut(false);
    }
  };

  return (
    <aside
      className={`sidebar ${isOpen ? "open" : ""}`}
      aria-hidden={!isOpen}
    >
      {/* Header */}
      <div className="sb-header">
        <div className="sb-brand">
          <img
            src={menroLogo}
            alt="MENRO Juban logo"
            className="sb-brand-logo"
          />

          <div className="sb-brand-text">
            <div className="sb-brand-name">MENRO</div>
            <div className="sb-brand-location">Juban, Sorsogon</div>
          </div>
        </div>

        <button
          type="button"
          className="sb-close"
          onClick={onClose}
          aria-label="Close sidebar"
          title="Close sidebar"
        >
          <X size={20} strokeWidth={1.9} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sb-nav">
        {navigation.map((group) => (
          <div className="sb-group" key={group.section}>
            <div className="sb-section">{group.section}</div>

            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `sb-item ${isActive ? "active" : ""}`
                  }
                >
                  <Icon
                    className="sb-item-icon"
                    size={17}
                    strokeWidth={1.8}
                  />

                  <span className="sb-item-label">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="sb-bottom">
        <div className="sb-user">
          <div className="sb-avatar">{initials}</div>

          <div className="sb-user-content">
            <div className="sb-user-name">{displayName}</div>
            <div className="sb-user-role">{roleLabel}</div>
          </div>
        </div>

        <button
          type="button"
          className="sb-logout"
          onClick={() =>
          setShowLogoutConfirm(true)
        }
        >
          <LogOut size={17} strokeWidth={1.8} />
          <span>Logout</span>
        </button>
      </div>

      {showLogoutConfirm && createPortal(
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 99999,
      background: "rgba(20, 30, 24, 0.32)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
    }}
    onMouseDown={(event) => {
      if (
        event.target === event.currentTarget &&
        !loggingOut
      ) {
        setShowLogoutConfirm(false);
      }
    }}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
      aria-describedby="logout-description"
      style={{
        width: "360px",
        maxWidth: "calc(100vw - 32px)",
        background: "#ffffff",
        borderRadius: "10px",
        padding: "22px",
        boxShadow:
          "0 12px 32px rgba(0, 0, 0, 0.16)",
      }}
    >
      <h3
        id="logout-title"
        style={{
          margin: "0 0 6px",
          fontSize: "19px",
          lineHeight: "1.3",
          fontWeight: 700,
          color: "#1f2d25",
        }}
      >
        Log out
      </h3>

      <p
        id="logout-description"
        style={{
          margin: 0,
          fontSize: "14px",
          lineHeight: "1.45",
          color: "#66736b",
        }}
      >
        Are you sure you want to log out?
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "10px",
          flexWrap: "wrap",
          marginTop: "16px",
        }}
      >
        <button
          type="button"
          disabled={loggingOut}
          onClick={() =>
            setShowLogoutConfirm(false)
          }
          style={{
            minWidth: "90px",
            minHeight: "40px",
            padding: "0 14px",
            margin: 0,
            border: "1px solid #d7dfda",
            borderRadius: "7px",
            background: "#ffffff",
            color: "#445149",
            fontSize: "14px",
            lineHeight: 1,
            fontWeight: 600,
            cursor: loggingOut
              ? "not-allowed"
              : "pointer",
            opacity: loggingOut ? 0.6 : 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            minWidth: "90px",
            minHeight: "40px",
            padding: "0 14px",
            margin: 0,
            border: "none",
            borderRadius: "7px",
            background: "#087443",
            color: "#ffffff",
            fontSize: "14px",
            lineHeight: 1,
            fontWeight: 600,
            cursor: loggingOut
              ? "not-allowed"
              : "pointer",
            opacity: loggingOut ? 0.75 : 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
            whiteSpace: "nowrap",
          }}
        >
          {loggingOut
            ? "Logging out..."
            : "Log out"}
        </button>
      </div>
    </div>
  </div>
, document.body)}

    </aside>
  );
}
