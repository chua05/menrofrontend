import { mergeConfig } from "vite";
import base from "./vite.phase3c-isolated.config.js";

export default mergeConfig(base, { define: {
  "import.meta.env.VITE_MONITORING_INFORMATION_ENABLED": JSON.stringify("true"),
  "import.meta.env.VITE_PERMANENT_SAMPLE_ANALYTICS_ENABLED": JSON.stringify("true"),
} });
