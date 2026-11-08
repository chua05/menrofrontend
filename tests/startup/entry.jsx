import { createElement } from "react";
import { createRoot } from "react-dom/client";
import AppErrorBoundary from "../../src/components/AppErrorBoundary";
import { bootstrapApplication } from "../../src/bootstrap";
import "../../src/styles/startup.css";
const mode = new URLSearchParams(location.search).get("mode");
export function BrokenView() { throw new Error("Test-only render failure"); }
void bootstrapApplication(async () => {
  if (mode === "import") throw new Error("Test-only module initialization failure");
  return { mount(root) { createRoot(root).render(createElement(AppErrorBoundary, null, mode === "render" ? createElement(BrokenView) : createElement("h1", null, "Application mounted"))); } };
}, document.getElementById("root"));
