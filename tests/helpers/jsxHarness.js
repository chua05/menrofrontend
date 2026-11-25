import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { transformSync } from "rolldown/experimental";

// Browser-free harness for React components: the JSX is compiled with Vite's own transformer
// (rolldown/oxc) and React hooks, the JSX runtime, Leaflet, CSS and network modules are replaced by
// small in-process stubs. Effects run synchronously after each render and are skipped when their
// dependency arrays are unchanged (Object.is), exactly like React. Each node:test file runs in its
// own process, so the hooks never leak into other tests.
export function installJsxHarness({ modules = {} } = {}) {
  const log = { fitBounds: 0, clearLayers: 0, tooltips: [], popups: [], created: [] };
  const layer = () => {
    const self = {
      bindTooltip(content) { log.tooltips.push(content); return self; },
      bindPopup(content) { log.popups.push(content); return self; }, addTo() { return self; }, on() { return self; },
      setStyle() { return self; },
      getBounds: () => ({ getSouth: () => 12.66, getWest: () => 123.93, getNorth: () => 12.67, getEast: () => 123.94 }),
    };
    return self;
  };
  const L = {
    map: () => ({ fitBounds() { log.fitBounds += 1; }, invalidateSize() {}, stop() {}, remove() {} }),
    tileLayer: layer, circle: layer, polygon: layer, circleMarker: layer, marker: layer, geoJSON: layer,
    divIcon: options => options,
    layerGroup: () => ({ addTo() { return this; }, clearLayers() { log.clearLayers += 1; }, getLayers: () => [] }),
    latLngBounds: () => ({ isValid: () => true, pad() { return this; } }),
  };
  const slots = [];
  let cursor = 0, pending = [];
  const harness = {
    L, log,
    reset() { Object.assign(log, { fitBounds: 0, clearLayers: 0, tooltips: [], popups: [], created: [] }); },
    slot(init) { if (!(cursor in slots)) slots[cursor] = init(); return slots[cursor++]; },
    effect(effect, deps) {
      const cell = harness.slot(() => ({ deps: undefined, cleanup: undefined }));
      const changed = !cell.deps || !deps || deps.length !== cell.deps.length || deps.some((dep, index) => !Object.is(dep, cell.deps[index]));
      if (changed) pending.push(() => { cell.cleanup?.(); cell.deps = deps; cell.cleanup = effect(); });
    },
    render(Component, props) { cursor = 0; pending = []; const output = Component(props); pending.forEach(run => run()); return output; },
  };
  const element = tagName => {
    const node = { tagName: String(tagName).toUpperCase(), nodeType: 1, children: [], className: "", textValue: "",
      append(...items) { node.children.push(...items); },
      addEventListener() {}, setAttribute() {},
      set textContent(value) { node.textValue = String(value); node.children = []; },
      get textContent() { return node.textValue + node.children.map(child => child.textContent).join(""); },
    };
    log.created.push(node.tagName);
    return node;
  };
  globalThis.__jsxHarness = harness;
  globalThis.window = { setTimeout: () => 0, clearTimeout() {} };
  globalThis.document = { createElement: element, createTextNode: text => ({ nodeType: 3, textContent: String(text) }) };

  const stubs = {
    "stub:react": `
      const h = globalThis.__jsxHarness;
      export function useRef(initial) { return h.slot(() => ({ current: initial })); }
      export function useState(initial) { const cell = h.slot(() => ({ value: initial })); return [cell.value, next => { cell.value = typeof next === "function" ? next(cell.value) : next; }]; }
      export function useEffect(effect, deps) { h.effect(effect, deps); }
    `,
    "stub:jsx": "export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const Fragment = 'fragment';",
    "stub:css": "export default {};",
    "stub:api": "export const authenticatedFetch = () => new Promise(() => {});",
    "stub:leaflet": "export default globalThis.__jsxHarness.L;",
  };
  const extra = Object.entries(modules);
  extra.forEach(([, source], index) => { stubs[`stub:extra-${index}`] = source; });
  registerHooks({
    resolve(specifier, context, next) {
      const custom = extra.findIndex(([match]) => specifier === match || specifier.endsWith(`/${match}`));
      if (custom >= 0) return { url: `stub:extra-${custom}`, shortCircuit: true };
      if (specifier === "react") return { url: "stub:react", shortCircuit: true };
      if (specifier === "react/jsx-runtime") return { url: "stub:jsx", shortCircuit: true };
      if (specifier === "leaflet") return { url: "stub:leaflet", shortCircuit: true };
      if (specifier.endsWith(".css")) return { url: "stub:css", shortCircuit: true };
      if (specifier.endsWith("/authenticatedApi")) return { url: "stub:api", shortCircuit: true };
      if (/^\.\.?\//.test(specifier) && !/\.[a-z]+$/i.test(specifier)) {
        for (const extension of [".js", ".jsx"]) {
          try { return next(`${specifier}${extension}`, context); } catch { /* try the next extension */ }
        }
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (stubs[url]) return { format: "module", source: stubs[url], shortCircuit: true };
      if (url.endsWith(".jsx")) {
        const file = fileURLToPath(url);
        const { code, errors } = transformSync(file, readFileSync(file, "utf8"), { jsx: { runtime: "automatic" } });
        assert.deepEqual(errors, []);
        return { format: "module", source: code, shortCircuit: true };
      }
      return next(url, context);
    },
  });
  return harness;
}

// Expands a stub JSX tree: function components are called (except those listed in `keep`, which
// are left as elements so their props can be inspected).
export function expand(node, keep = new Set()) {
  if (Array.isArray(node)) return node.map(child => expand(child, keep));
  if (!node || typeof node !== "object" || !("type" in node)) return node;
  if (typeof node.type === "function" && !keep.has(node.type)) return expand(node.type(node.props || {}), keep);
  const children = node.props?.children;
  return { ...node, props: { ...node.props, children: children === undefined ? undefined : expand(children, keep) } };
}

export function textOf(node) {
  if (node === null || node === undefined || node === false || node === true) return "";
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node !== "object") return String(node);
  return textOf(node.props?.children);
}

export function findAll(node, predicate, found = []) {
  if (Array.isArray(node)) { node.forEach(child => findAll(child, predicate, found)); return found; }
  if (!node || typeof node !== "object" || !("type" in node)) return found;
  if (predicate(node)) found.push(node);
  findAll(node.props?.children, predicate, found);
  return found;
}

// [label, value] pairs of every <dt>/<dd> definition row.
export function definitions(tree) {
  return findAll(tree, node => node.type === "div" && findAll(node.props?.children, child => child.type === "dt").length === 1
    && Array.isArray(node.props.children) && node.props.children.some(child => child?.type === "dt"))
    .map(row => [textOf(row.props.children.find(child => child?.type === "dt")), textOf(row.props.children.find(child => child?.type === "dd"))]);
}
