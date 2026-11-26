// Filtering for permanent-sample tree markers on the full Planting Sites Map. Each tree is matched on its own
// barangay, site, species and latest condition, never on its parent site's aggregate fields.

// One barangay or species however it was typed: "Zone VIII Poblacion" and "ZoneVIIIPoblacion" are one place.
const canonical = (value) => String(value || "").toLocaleLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const active = (value) => value && value !== "All";

export function treeMatches(tree, { barangay, site, species, condition } = {}) {
  if (active(barangay) && canonical(tree.barangay) !== canonical(barangay)) return false;
  if (active(site) && tree.siteId !== site && tree.siteName !== site) return false;
  if (active(species) && canonical(tree.species) !== canonical(species)) return false;
  if (active(condition) && tree.condition !== condition) return false;
  return true;
}

export function filterMapTrees(trees, filters = {}) {
  return trees.filter((tree) => treeMatches(tree, filters));
}

// A site with no direct species or condition field still matches when one of its own trees does.
export function siteHasMatchingTree(site, trees, { species, condition } = {}) {
  return trees.some((tree) => (tree.siteId === site.siteId || (!tree.siteId && tree.siteName === site.siteName)) && treeMatches(tree, { species, condition }));
}
