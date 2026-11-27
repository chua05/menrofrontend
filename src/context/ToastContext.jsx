/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/toast.css";

export const DEFAULT_TOAST_DURATION = 8000;
// At most this many alerts show at once; older ones leave first, so the stack never runs down the screen.
export const MAX_VISIBLE_TOASTS = 3;
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
      setToasts((current) => [...current, { id, key, title: String(options.title || ""), message: text, type, floating: options.floating === true, dismissible: options.dismissible === true, exiting: false }]);
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

  useEffect(() => {
    const clearLogin = () => {
      for (const [key, id] of activeKeys.current) if (key.startsWith("login-success:")) remove(id);
    };
    window.addEventListener("menro:clear-login-toast", clearLogin);
    return () => window.removeEventListener("menro:clear-login-toast", clearLogin);
  }, [remove]);

  const api = useMemo(() => ({
    showToast,
    success: (message, options) => showToast(message, { ...options, type: "success" }),
    error: (message, options) => showToast(message, { ...options, type: "error" }),
    warning: (message, options) => showToast(message, { ...options, type: "warning" }),
    info: (message, options) => showToast(message, { ...options, type: "info" }),
    dismiss,
  }), [dismiss, showToast]);

  // At most MAX_VISIBLE_TOASTS alerts at once: a newer one retires the oldest (with its exit animation) rather than
  // leaving it hidden with a running timer.
  useEffect(() => {
    const showing = toasts.filter((toast) => !toast.exiting);
    showing.slice(0, Math.max(0, showing.length - MAX_VISIBLE_TOASTS)).forEach((toast) => dismiss(toast.id));
  }, [toasts, dismiss]);

  // One viewport-fixed alert layer at the upper centre of the screen. A native modal <dialog> is drawn in the browser's
  // top layer, above anything z-index can reach, so while one is open the layer lives in the topmost open dialog (still
  // position: fixed, so it stays at the viewport's upper centre); otherwise in <body>, above every other layer. Nothing is
  // ever inserted into the page flow, so showing an alert moves no header, field, button or modal.
  const container = useTopLayerContainer(toasts.length > 0);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 && container && createPortal(
        <div className="menro-toast-viewport" aria-label="Notifications">
          {toasts.slice(-MAX_VISIBLE_TOASTS).map((toast) => (
            <div
              key={toast.id}
              className={`menro-toast menro-toast-${toast.type}${toast.floating ? " menro-toast-floating" : ""}${toast.exiting ? " exiting" : ""}`}
              role={toast.type === "error" ? "alert" : "status"}
              aria-live={toast.type === "error" ? "assertive" : "polite"}
              aria-atomic="true"
            >
              {toast.title && <strong className="menro-toast-title">{toast.title}</strong>}
              {toast.message}
              {toast.dismissible && <button type="button" className="menro-toast-dismiss" aria-label={`Dismiss ${toast.title || "notification"}`} onClick={() => dismiss(toast.id)}>×</button>}
            </div>
          ))}
        </div>,
        container
      )}
    </ToastContext.Provider>
  );
}

// Open native dialogs in the order they were opened (the browser's top-layer order), oldest first. Recorded from "open"
// attribute changes; dialogs already open when this module loads keep document order.
const dialogOpenOrder = [];
function noteDialogs(records) {
  for (const record of records) {
    const dialog = record.target;
    if (record.type !== "attributes" || dialog.tagName !== "DIALOG") continue;
    const index = dialogOpenOrder.indexOf(dialog);
    if (index >= 0) dialogOpenOrder.splice(index, 1);
    if (dialog.open) dialogOpenOrder.push(dialog);
  }
}
export function topmostOpenDialog() {
  const open = [...document.querySelectorAll("dialog[open]")];
  const ordered = dialogOpenOrder.filter((dialog) => dialog.isConnected && dialog.open);
  return ordered.at(-1) || open.at(-1) || null;
}

// A single container node for the alert layer, kept in the topmost open dialog or else in <body>. It is moved (never
// recreated), so an alert is not re-announced or remounted when a dialog opens or closes, and it is placed before paint,
// so an alert never appears behind a dialog even for a frame.
function useTopLayerContainer(active) {
  const [container] = useState(() => {
    if (typeof document === "undefined") return null;
    const node = document.createElement("div");
    node.className = "menro-toast-host";
    return node;
  });
  const [, setOpenDialogs] = useState(0);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return undefined;
    // Only the "open" attribute anywhere, and dialogs added to or removed from <body> (where ModalDialog portals them).
    const opened = new MutationObserver((records) => { noteDialogs(records); setOpenDialogs((count) => count + 1); });
    opened.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    const removed = new MutationObserver(() => setOpenDialogs((count) => count + 1));
    removed.observe(document.body, { childList: true });
    return () => { opened.disconnect(); removed.disconnect(); };
  }, []);
  useLayoutEffect(() => {
    if (!container || !active) return;
    const host = topmostOpenDialog() || document.body;
    if (container.parentNode !== host) host.appendChild(container);
  });
  useEffect(() => () => container?.remove(), [container]);
  return container;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider.");
  return context;
}
