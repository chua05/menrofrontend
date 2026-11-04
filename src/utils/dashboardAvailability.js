export const DASHBOARD_UNAVAILABLE_MESSAGE = "Some dashboard information is temporarily unavailable. Please try again.";
export const DASHBOARD_SOURCES = ["requests", "sites", "reports", "events", "monitoring", "users", "inventory", "distributions"];
const DEPENDENCIES = { allocated: ["distributions"], participants: ["users"], planted: ["reports"], survival: ["reports", "monitoring"], events: ["events"],
  "my-requests": ["requests"], approved: ["requests"], "my-reports": ["reports"], "my-trees": ["reports"], monitoring: ["monitoring"] };
export function metricAvailability(item, unavailable, barangayScoped = false) {
  const dependencies = [...(DEPENDENCIES[item.id] || []), ...(barangayScoped ? ["sites", "requests", "events", "distributions", "reports"] : [])];
  return dependencies.some(name => unavailable.has(name)) ? { ...item, value: "Unavailable", note: "Please retry to load this information." } : item;
}
