// Page layout: like the workflow tests, plus the Tailwind base styles production uses.
import tailwindcss from "@tailwindcss/vite";
import base from "./vite.workflow-test.config.js";
export default { ...base, plugins: [...base.plugins, tailwindcss()] };
