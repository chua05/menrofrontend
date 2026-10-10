/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/toast.css";

export const DEFAULT_TOAST_DURATION = 8000;
const EXIT_DURATION = 220;
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const scheduledFrames = useRef(new Map());
  const activeKeys = useRef(new Map());
  const nextId = useRef(0);

  const remove = useCallback((id) => {
    const frames = scheduledFrames.current.get(id);
    if (frames && typeof window.cancelAnimationFrame === "function") {
      if (frames.first) window.cancelAnimationFrame(frames.first);
      if (frames.second) window.cancelAnimationFrame(frames.second);
    }
    scheduledFrames.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    for (const [key, activeId] of activeKeys.current) {
      if (activeId === id) activeKeys.current.delete(key);
    }
  }, []);

  const dismiss = useCallback((id) => {
    if (scheduledFrames.current.has(id)) {
      remove(id);
      return;
    }
    setToasts((current) => current.map((toast) =>
      toast.id === id ? { ...toast, exiting: true } : toast
    ));
    const previousTimer = timers.current.get(id);
    if (previousTimer) window.clearTimeout(previousTimer);
    timers.current.set(id, window.setTimeout(() => remove(id), EXIT_DURATION));
  }, [remove]);

  const showToast = useCallback((message, options = {}) => {
    const text = String(message || "").trim();
    if (!text) return null;
    const type = ["success", "error", "warning", "info"].includes(options.type)
      ? options.type
      : "info";
    const key = options.dedupeKey || `${type}:${text}`;
    const existingId = activeKeys.current.get(key);
    if (existingId) return existingId;

    const id = ++nextId.current;
    const duration = Number.isFinite(options.duration)
      ? Math.max(0, options.duration)
      : DEFAULT_TOAST_DURATION;
    activeKeys.current.set(key, id);

    const makeVisible = () => {
      scheduledFrames.current.delete(id);
      setToasts((current) => [...current, { id, key, message: text, type, exiting: false }]);
      if (duration > 0) {
        timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
      }
    };

    // Publish after React has painted the state change that prompted the
    // message. The auto-dismiss clock deliberately starts in makeVisible.
    if (typeof window.requestAnimationFrame === "function") {
      const frames = { first: 0, second: 0 };
      frames.first = window.requestAnimationFrame(() => {
        frames.second = window.requestAnimationFrame(makeVisible);
      });
      scheduledFrames.current.set(id, frames);
    } else {
      makeVisible();
    }
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    for (const frames of scheduledFrames.current.values()) {
      if (frames.first) window.cancelAnimationFrame(frames.first);
      if (frames.second) window.cancelAnimationFrame(frames.second);
    }
    scheduledFrames.current.clear();
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
    activeKeys.current.clear();
  }, []);

  const api = useMemo(() => ({
    showToast,
    success: (message, options) => showToast(message, { ...options, type: "success" }),
    error: (message, options) => showToast(message, { ...options, type: "error" }),
    warning: (message, options) => showToast(message, { ...options, type: "warning" }),
    info: (message, options) => showToast(message, { ...options, type: "info" }),
    dismiss,
  }), [dismiss, showToast]);

  const modalAnchors = typeof document === "undefined"
    ? []
    : Array.from(document.querySelectorAll("[data-menro-toast-anchor]"));
  const pageAnchor = typeof document === "undefined"
    ? null
    : document.querySelector("[data-menro-toast-page-anchor]");
  const toastPlacement = modalAnchors.length ? "modal" : pageAnchor ? "page" : "viewport";
  const toastHost = modalAnchors.at(-1) || pageAnchor ||
    (typeof document !== "undefined" ? document.body : null);
  const toastViewport = (
    <div
      className={`menro-toast-viewport menro-toast-viewport-${toastPlacement}`}
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`menro-toast menro-toast-${toast.type}${toast.exiting ? " exiting" : ""}`}
          role={toast.type === "error" ? "alert" : "status"}
          aria-live={toast.type === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 && toastHost && createPortal(toastViewport, toastHost)}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider.");
  return context;
}
