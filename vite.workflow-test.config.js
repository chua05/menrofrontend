import path from "node:path";
import { fileURLToPath } from "node:url";
import base from "./vite.phase3c-test.config.js";
const root = path.dirname(fileURLToPath(import.meta.url));
const replacements = new Map([
  [path.join(root, "src/services/authenticatedApi.js"), path.join(root, "tests/workflows/api.js")],
  [path.join(root, "src/firebase/config.js"), path.join(root, "tests/workflows/firebase.js")],
]);
const isolation = { name: "workflow-test-boundaries", enforce: "pre", resolveId(source, importer) {
  if (!importer || !source.startsWith(".")) return null;
  const requested = path.resolve(path.dirname(importer), source);
  return replacements.get(requested) || replacements.get(`${requested}.js`) || null;
} };
export default { ...base, plugins: [isolation, ...base.plugins],
  define: { ...base.define, "import.meta.env.VITE_API_URL": JSON.stringify("http://127.0.0.1:5184/api") } };
