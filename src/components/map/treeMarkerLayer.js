// Permanent-sample tree markers shared by the Analytics mini-map and the full Planting Sites Map.
// Every marker sits at the tree's saved registration GPS; nothing here moves, spreads or invents a position.
import L from "leaflet";
import "../../styles/tree-markers.css";

// Condition of the latest Admin-approved visit; never inferred from a photo.
export const TREE_CONDITIONS = [["Healthy", "healthy", "Healthy"], ["Damaged", "damaged", "Damaged (Living)"], ["Dead", "dead", "Dead"], ["Needs Rechecking", "rechecking", "Needs Rechecking"]];
export const conditionSlug = (condition) => TREE_CONDITIONS.find(([value]) => value === condition)?.[1] || "rechecking";
export const conditionLabel = (condition) => TREE_CONDITIONS.find(([value]) => value === condition)?.[2] || condition || "Not recorded";
const isPending = (tree) => tree.reviewStatus === "Pending Review";
const markerSlug = (tree) => (isPending(tree) ? "pending" : conditionSlug(tree.condition));
export const TREE_PATH = "M12 1 4 11h5l-6 8h7v8h4v-8h7l-6-8h5z";

const CLUSTER_PIXELS = 26;
export const locatedTrees = (trees) => trees.filter((tree) => Number.isFinite(Number(tree.latitude)) && Number.isFinite(Number(tree.longitude)));

// Trees that would overlap on screen at the current zoom share one marker with a count, so none is hidden.
// Each tree keeps its saved position: a group is drawn at its first tree and zooming in separates it again.
function groupForZoom(map, trees) {
  const groups = [];
  for (const tree of locatedTrees(trees)) {
    const point = map.latLngToLayerPoint([Number(tree.latitude), Number(tree.longitude)]);
    const group = groups.find((entry) => entry.point.distanceTo(point) <= CLUSTER_PIXELS);
    if (group) group.trees.push(tree);
    else groups.push({ point, latitude: Number(tree.latitude), longitude: Number(tree.longitude), trees: [tree] });
  }
  return groups;
}
const samePosition = (group) => new Set(group.trees.map((tree) => `${Number(tree.latitude).toFixed(7)},${Number(tree.longitude).toFixed(7)}`)).size === 1;

function treeIcon(group) {
  const slugs = new Set(group.trees.map(markerSlug));
  const slug = slugs.size === 1 ? [...slugs][0] : "mixed";
  const count = group.trees.length > 1 ? `<span class="ra-tree-count">${group.trees.length}</span>` : "";
  return L.divIcon({ className: `ra-tree-marker ra-tree-${slug}`, html: `<svg viewBox="0 0 24 30" aria-hidden="true"><path d="${TREE_PATH}"/></svg>${count}`,
    iconSize: [22, 28], iconAnchor: [11, 27], popupAnchor: [0, -26] });
}

// Built with textContent only: record values are never interpreted as HTML.
function treePopup(group) {
  const root = document.createElement("div");
  root.className = "ra-tree-popup";
  for (const tree of group.trees) {
    const pending = isPending(tree);
    const item = document.createElement("div");
    item.className = `ra-tree-popup-item${pending ? " is-pending" : ""}`;
    const heading = document.createElement("strong");
    heading.textContent = tree.treeId || "Permanent sample tree";
    const list = document.createElement("dl");
    const visit = tree.visitNumber ? `Visit ${tree.visitNumber}` : "—";
    const rows = [["Tree Species", tree.species || "Not recorded"], ["Planting Site", tree.siteName || "—"],
      pending ? ["Submitted Visit", `${visit} — Pending Admin Review (not yet approved)`] : ["Latest Approved Visit", visit],
      ["Date Monitored", tree.dateMonitored || "—"], [pending ? "Submitted Condition" : "Condition", conditionLabel(tree.condition)],
      ["Height", tree.heightCentimeters == null ? "Not recorded" : `${tree.heightCentimeters} cm`],
      ["Stem Diameter", tree.stemDiameterMillimeters == null ? "Not recorded" : `${tree.stemDiameterMillimeters} mm`]];
    if (tree.pendingReview) rows.push(["Pending Review", `Visit ${tree.pendingReview.visitNumber || "—"}: ${conditionLabel(tree.pendingReview.condition)} (not yet approved)`]);
    for (const [label, value] of rows) {
      const term = document.createElement("dt"), detail = document.createElement("dd");
      term.textContent = label; detail.textContent = String(value);
      list.append(term, detail);
    }
    item.append(heading, list);
    root.append(item);
  }
  return root;
}

// Draws the trees into `layer` and regroups them on every zoom. Returns the function that stops listening.
export function renderTreeMarkers(map, layer, trees) {
  const render = () => {
    layer.clearLayers();
    for (const group of groupForZoom(map, trees)) {
      const single = group.trees.length === 1;
      // Separable groups zoom in on click; trees saved at one identical position (or at the deepest zoom) list in one popup.
      const listInPopup = single || samePosition(group) || map.getZoom() >= map.getMaxZoom();
      const first = group.trees[0];
      const label = single ? `${first.treeId} · ${isPending(first) ? "Pending Review" : conditionLabel(first.condition)}` : `${group.trees.length} permanent sample trees${listInPopup ? "" : " (zoom in)"}`;
      const marker = L.marker([group.latitude, group.longitude], { icon: treeIcon(group), title: label, alt: label, keyboard: true, riseOnHover: true, zIndexOffset: 500 });
      if (listInPopup) marker.bindPopup(treePopup(group), { maxWidth: 260, maxHeight: 280, autoPanPadding: [16, 16] });
      else marker.on("click", () => map.fitBounds(L.latLngBounds(group.trees.map((tree) => [Number(tree.latitude), Number(tree.longitude)])).pad(0.3), { maxZoom: map.getMaxZoom() }));
      marker.addTo(layer);
    }
  };
  render();
  map.on("zoomend", render);
  return () => { map.off("zoomend", render); };
}
