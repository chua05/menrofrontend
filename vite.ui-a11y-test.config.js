import path from "node:path";
import { fileURLToPath } from "node:url";
import base from "./vite.workflow-test.config.js";
const root = path.dirname(fileURLToPath(import.meta.url));
// Keep existing mock suites unchanged; this UI audit needs the same CSS reset,
// fonts and containment rules imported by the real production entry.
const productionStyles = { name: "ui-audit-production-styles", transform(code, id) {
  if (id.split("?")[0] !== path.join(root, "tests/phase3c/entry.jsx").replaceAll("\\", "/")) return null;
  return { code: 'import "../../src/index.css";\nimport "../../src/styles/auth.css";\nimport "../../src/styles/leaflet-containment.css";\n' + code, map: null };
} };
export default { ...base, plugins: [...base.plugins, productionStyles] };
