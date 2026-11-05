import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Native modal dialogs put the background outside the active focus/navigation
// scope. Close the dialog and restore focus before callers hide its contents.
export default function ModalDialog({ open = true, onClose, dismissible = true, busy = false, className, label, id, returnFocusSelector, children }) {
  const dialogRef = useRef(null);
  const restoreRef = useRef(null);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      const target = trigger?.isConnected && !trigger.disabled && !trigger.closest("[inert]")
        ? trigger : document.querySelector(returnFocusSelector || ".topbar-menu-btn");
      target?.focus({ preventScroll: true });
    };
    restoreRef.current = restore;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return restore;
  }, [open, returnFocusSelector]);

  const close = () => {
    if (!dismissible) return;
    restoreRef.current?.();
    onClose();
  };
  const containTab = event => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    const controls = [...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')]
      .filter(control => !control.disabled && control.tabIndex >= 0 && !control.closest("[inert],[hidden]") &&
        control.getClientRects().length > 0 && getComputedStyle(control).visibility !== "hidden");
    const first = controls[0], last = controls.at(-1), focused = document.activeElement;
    if (!first) { event.preventDefault(); dialog.focus({ preventScroll: true }); }
    else if (event.shiftKey && (focused === first || focused === dialog)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (focused === last || focused === dialog)) { event.preventDefault(); first.focus(); }
  };
  return createPortal(<dialog ref={dialogRef} id={id} className={`menro-modal-dialog ${className || ""}`} aria-label={label} aria-modal="true" aria-busy={busy}
    onKeyDown={containTab}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }}
    onClick={event => { if (event.target.closest("[data-modal-close]")) close(); }}
    onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    {children}
  </dialog>, document.body);
}
