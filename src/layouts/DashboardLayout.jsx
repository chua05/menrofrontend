import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

import "../styles/dashboard-shell.css";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [location.pathname]);

  return (
    <div className="dashboard-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="dashboard-main">
        <Topbar sidebarOpen={sidebarOpen} onOpenSidebar={() => setSidebarOpen(true)} />

        <div className="menro-toast-page-anchor" data-menro-toast-page-anchor />

        <main className="dashboard-page-content">
          <div
            key={location.pathname}
            className="route-transition"
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
