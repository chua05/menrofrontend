import "../styles/loading-indicator.css";

// The MENRO loading indicator: one green spinner centred in the area that is loading. The message is announced to screen
// readers (role="status") instead of being shown as plain "Loading..." text.
//   page:    fills the main content area (inside the layout, so never over the top bar or sidebar)
//   section: centred in its card, table, chart, list or modal body
//   inline:  a small spinner in a line of content, such as a dropdown or a legend
// announce={false} draws the spinner only, for a second indicator while another one already announces the same load.
export default function LoadingIndicator({ message = "Loading…", variant = "section", className = "", announce = true }) {
  return (
    <div className={`menro-loading menro-loading-${variant}${className ? ` ${className}` : ""}`} {...(announce ? { role: "status", "aria-live": "polite" } : { "aria-hidden": "true" })}>
      <span className="menro-spinner" aria-hidden="true" />
      <span className="menro-visually-hidden">{message}</span>
    </div>
  );
}
