// Sidebar layout audit: the ui-a11y build plus a placeholder MapTiler key, so Leaflet maps really initialise.
// The spec aborts every tile request; the key never reaches MapTiler.
import base from "./vite.ui-a11y-test.config.js";
export default { ...base, define: { ...base.define, "import.meta.env.VITE_MAPTILER_API_KEY": JSON.stringify("test-placeholder-key") } };
