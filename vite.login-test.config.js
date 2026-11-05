import path from "node:path";
import { fileURLToPath } from "node:url";
import base from "./vite.ui-a11y-test.config.js";
const root = path.dirname(fileURLToPath(import.meta.url));
const authMock = path.join(root, "tests/login/authBoundary.js");
const isolate = { name: "login-acceptance-boundary", enforce: "pre", resolveId(source, importer) {
  if (!importer) return null;
  const requested = source.startsWith(".") ? path.resolve(path.dirname(importer), source) : source;
  if (["AuthContext", "AuthContext.jsx"].some(name => requested === path.join(root, "src/context", name))) return path.join(root, "tests/login/AuthContext.js");
  if (importer.replaceAll("\\", "/").endsWith("/src/pages/LoginPage.jsx") &&
      (source === "firebase/auth" || ["authenticatedApi", "googleRedirectAuth"].some(name => [name, `${name}.js`].some(file => requested === path.join(root, "src/services", file))))) return authMock;
  return null;
} };
export default { ...base, plugins: [isolate, ...base.plugins] };
