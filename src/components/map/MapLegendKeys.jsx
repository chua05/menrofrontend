// Legend keys drawn with the same shapes and colours as the map itself.
import { TREE_PATH } from "./treeMarkerLayer";
import { SITE_CENTER_COLOR } from "./siteOverlayLayer";
import { UTILIZATION_LEVELS } from "../../utils/siteUtilization";

export function TreeKey({ slug, count }) {
  return (
    <span className={`map-tree-key ra-tree-${slug}`} aria-hidden="true">
      <svg viewBox="0 0 24 30"><path d={TREE_PATH} /></svg>
      {count && <span className="ra-tree-count">{count}</span>}
    </span>
  );
}

// A transparent area with its outline, as a coverage overlay is drawn.
export function UtilizationSwatch({ level }) {
  const { fill, stroke } = UTILIZATION_LEVELS[level];
  return <span className="map-utilization-key" aria-hidden="true" style={{ background: `${fill}3d`, borderColor: stroke }} />;
}

export function SiteCenterKey() {
  return <span className="map-site-center-key" aria-hidden="true" style={{ background: SITE_CENTER_COLOR }} />;
}
