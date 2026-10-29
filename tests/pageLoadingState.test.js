import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const component = read("../src/components/PageLoadingState.jsx");
const styles = read("../src/styles/page-loading-state.css");

test("shared page loading state centers content without overflowing its page", () => {
  assert.match(component, /role="status" aria-live="polite"/);
  assert.match(styles, /min-height:\s*420px/);
  assert.match(styles, /place-items:\s*center/);
  assert.match(styles, /max-width:\s*100%/);
  assert.match(styles, /padding:\s*24px/);
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
