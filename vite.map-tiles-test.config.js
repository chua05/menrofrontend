// Map basemap tests: the layout test build plus a placeholder MapTiler key, so the production tile path runs.
// Every tile request is answered locally by the Playwright spec; the key never reaches MapTiler.
import base from "./vite.ui-layout-test.config.js";
export default { ...base, define: { ...base.define, "import.meta.env.VITE_MAPTILER_API_KEY": JSON.stringify("test-placeholder-key") } };
