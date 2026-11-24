// Leaflet assigns string tooltip content with innerHTML. Site names and report labels are user
// data, so call sites pass a DOM element whose textContent holds the literal text instead.
export function textTooltip(text) {
  const label = document.createElement("span");
  label.textContent = text;
  return label;
}
