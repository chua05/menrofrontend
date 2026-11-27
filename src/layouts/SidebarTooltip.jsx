import { createPortal } from "react-dom";

// Rail item names, drawn in <body> with fixed positioning so the scrolling nav never clips them.
// The rail link already carries the same text as its aria-label.
export default function SidebarTooltip({ tooltip }) {
  if (!tooltip) return null;

  return createPortal(
    <div
      className="sb-tooltip"
      role="tooltip"
      style={{ top: tooltip.top, left: tooltip.left }}
    >
      {tooltip.label}
    </div>,
    document.body,
  );
}
