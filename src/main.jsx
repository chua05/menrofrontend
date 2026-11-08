import "./index.css";
import "./styles/auth.css";
import "./styles/leaflet-containment.css";
import "./styles/startup.css";
import { bootstrapApplication } from "./bootstrap";

// Keep Firebase and the route graph inside the guarded import: initialization
// failures happen before React can render an error boundary.
void bootstrapApplication(() => import("./renderApp.jsx"), document.getElementById("root"));
