import { useCallback, useEffect, useState } from "react";

// Docked (>= 768px): the sidebar pushes the page and toggles between expanded and a 72px rail.
// Drawer (< 768px): the sidebar is the modal overlay opened by the hamburger.
const DOCKED_QUERY = "(min-width: 768px)";
const DEFAULT_EXPANDED_MIN_WIDTH = 1280;
const STORAGE_KEY = "menro-sidebar-expanded";

function isDockedViewport() {
  return window.matchMedia(DOCKED_QUERY).matches;
}

function readStoredExpanded() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    // Storage can be unavailable (private mode, blocked site data): use the default.
  }
  return null;
}

function readInitialExpanded() {
  return readStoredExpanded() ?? window.innerWidth >= DEFAULT_EXPANDED_MIN_WIDTH;
}

export default function useSidebarMode() {
  const [docked, setDocked] = useState(isDockedViewport);
  const [expanded, setExpanded] = useState(readInitialExpanded);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(DOCKED_QUERY);
    const handleChange = (event) => {
      setDocked(event.matches);
      // Entering docked mode never leaves a modal drawer open (or reopening later).
      if (event.matches) setDrawerOpen(false);
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  // With no remembered choice the default follows the 1280px breakpoint; a stored choice is never overridden.
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${DEFAULT_EXPANDED_MIN_WIDTH}px)`);
    const handleChange = (event) => {
      if (readStoredExpanded() === null) setExpanded(event.matches);
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  // Only an explicit toggle is remembered; untouched visits keep the viewport default.
  const toggleExpanded = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Ignore storage failures; the in-memory state still works.
    }
  }, [expanded]);

  return {
    docked,
    expanded,
    drawerOpen,
    toggleExpanded,
    openDrawer: useCallback(() => setDrawerOpen(true), []),
    closeDrawer: useCallback(() => setDrawerOpen(false), []),
  };
}
