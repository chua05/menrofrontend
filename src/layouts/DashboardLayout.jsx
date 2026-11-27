import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import useSidebarMode from "./useSidebarMode";

import "../styles/dashboard-shell.css";

// Longest expand/collapse transition plus slack; covers reduced motion (no transitionend).
const RESIZE_FALLBACK_MS = 400;

export default function DashboardLayout() {
  const { docked, expanded, drawerOpen, toggleExpanded, openDrawer, closeDrawer } = useSidebarMode();
  const location = useLocation();
  const mainRef = useRef(null);
  const settledExpanded = useRef(expanded);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [location.pathname]);

  // Once the page finishes resizing for the new sidebar width, tell maps and charts to re-measure.
  useEffect(() => {
    if (settledExpanded.current === expanded) return undefined;
    settledExpanded.current = expanded;
    const main = mainRef.current;
    let fired = false;
    const notify = () => {
      if (fired) return;
      fired = true;
      window.dispatchEvent(new Event("resize"));
    };
    const handleTransitionEnd = (event) => {
      if (event.target === main && event.propertyName === "margin-left") notify();
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    main.addEventListener("transitionend", handleTransitionEnd);
    const fallback = window.setTimeout(notify, reducedMotion ? 0 : RESIZE_FALLBACK_MS);
    return () => {
      main.removeEventListener("transitionend", handleTransitionEnd);
      window.clearTimeout(fallback);
    };
  }, [expanded]);

  const shellMode = docked
    ? `sidebar-docked ${expanded ? "sidebar-expanded" : "sidebar-rail"}`
    : "sidebar-drawer";

  return (
    <div className={`dashboard-shell ${shellMode}`}>
      <Sidebar
        mode={docked ? "docked" : "drawer"}
        expanded={expanded}
        isOpen={drawerOpen}
        onClose={closeDrawer}
      />

      <div className="dashboard-main" ref={mainRef}>
        <Topbar
          sidebarDocked={docked}
          sidebarExpanded={docked ? expanded : drawerOpen}
          onToggleSidebar={docked ? toggleExpanded : openDrawer}
        />


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
