import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
const resolve = (value) => fileURLToPath(new URL(value, import.meta.url));
const isolatedModules = new Map([
  [resolve("./src/firebase/config.js"), resolve("./tests/phase3c/mocks/firebaseConfig.js")],
  [resolve("./src/context/AuthContext.jsx"), resolve("./tests/phase3c/mocks/AuthContext.jsx")],
  [resolve("./src/services/authenticatedApi.js"), resolve("./tests/phase3c/mocks/authenticatedApi.js")],
  [resolve("./src/components/SecureCameraCapture.jsx"), resolve("./tests/phase3c/mocks/SecureCameraCapture.jsx")],
]);

const phase3cIsolation = {
  name: "phase3c-test-module-isolation",
  enforce: "pre",
  resolveId(source, importer) {
    if (!importer || !source.startsWith(".")) return null;
    const requested = path.resolve(path.dirname(importer), source);
    for (const candidate of [requested, `${requested}.js`, `${requested}.jsx`]) {
      const replacement = isolatedModules.get(candidate);
      if (replacement) return replacement;
    }
    return null;
  },
};
export default defineConfig({
  root: resolve("./tests/phase3c"),
  plugins: [phase3cIsolation, react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_VERIFIED_PLANTING_COHORT_ENABLED":
      "window.__PHASE3C_GATE_ENABLED__ || 'true'",
  },
  server: { host: "127.0.0.1", strictPort: true },
});
