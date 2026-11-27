import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const component = read("../src/components/PageLoadingState.jsx");
const indicator = read("../src/components/LoadingIndicator.jsx");
const styles = read("../src/styles/loading-indicator.css");

test("shared page loading state is the green spinner, centred without overflowing its page", () => {
  assert.match(component, /<LoadingIndicator variant="page"/);
  assert.match(indicator, /announce = true/);
  assert.match(indicator, /announce \? \{ role: "status", "aria-live": "polite" \}/);
  assert.match(indicator, /className="menro-spinner" aria-hidden="true"/);
  assert.match(indicator, /className="menro-visually-hidden">\{message\}/);
  // Default size only: an area's own height and padding win, so it keeps the size it had while loading.
  const page = styles.match(/:where\(\.menro-loading-page\)\s*\{([^}]*)\}/)[1];
  assert.match(page, /min-height:\s*420px/);
  assert.match(page, /padding:\s*24px/);
  assert.match(styles, /place-items:\s*center/);
  assert.match(styles, /max-width:\s*100%/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.menro-spinner\s*\{\s*animation:\s*none/);
});

test("full-page MENRO loaders use the shared state while contextual loaders remain separate", () => {
  const pages = [
    ["MyRequestsPage.jsx", "Loading your requests..."],
    ["ParticipantSaplingRequestWizard.jsx", "Loading request form..."],
    ["PlantingPage.jsx", "Loading planting reports..."],
    ["SeedlingRequestsPage.jsx", "Loading seedling requests..."],
    ["UsersPage.jsx", "Loading users..."],
    ["EventSchedulePage.jsx", "Loading events..."],
    ["DashboardPage.jsx", "Loading dashboard..."],
  ];
  for (const [file, message] of pages) {
    const source = read(`../src/pages/${file}`);
    assert.match(source, /import PageLoadingState from "\.\.\/components\/PageLoadingState"/);
    assert.match(source, new RegExp(`<PageLoadingState message="${message}"`));
  }
});
