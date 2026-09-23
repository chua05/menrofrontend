export default function FormAlert({ type = "info", children }) {
  if (!children) return null;

  const liveRole = type === "error" ? "alert" : "status";

  return (
    <div
      className={`form-alert form-alert-${type}`}
      role={liveRole}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}
