import { Children } from "react";
import "../styles/kpi-cards.css";

// The one KPI card design used on every page (from Planting Reports). `tone` only colors the value.
export function KpiGrid({ label, className = "", children }) {
  return (
    <section className={`kpi-grid ${className}`.trim()} aria-label={label} data-count={Children.toArray(children).length}>
      {children}
    </section>
  );
}

// `text` is for values that are words or dates instead of a figure. With `onClick` the card is a button.
export default function KpiCard({ title, value, description, tone = "total", text = false, onClick, ...rest }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`kpi-card kpi-tone-${tone}`} {...(onClick ? { type: "button", onClick } : {})} {...rest}>
      <span className="kpi-card-title">{title}</span>
      <strong className={`kpi-card-value${text ? " is-text" : ""}`}>{value}</strong>
      {description && <span className="kpi-card-description">{description}</span>}
    </Tag>
  );
}
