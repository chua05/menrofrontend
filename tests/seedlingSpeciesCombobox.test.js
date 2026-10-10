import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/pages/SeedlingsPage.jsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../src/styles/seedlings.css", import.meta.url),
  "utf8",
);

test("Add Sapling uses its local accessible species combobox instead of browser datalist UI", () => {
  assert.match(source, /<SpeciesCombobox[\s\S]*?options=\{speciesOptions\}[\s\S]*?updateForm\([\s\S]*?"treeName"/);
  assert.doesNotMatch(source, /<datalist id="menro-sapling-species"/);
  assert.match(source, /role="combobox"[\s\S]*?aria-autocomplete="list"[\s\S]*?role="listbox"/);
});

test("species selection retains scientific-name lookup and keyboard controls", () => {
  assert.match(source, /if \(field === "treeName"\)[\s\S]*?next\.scientificName = species\?\.scientificName \|\| ""/);
  for (const key of ["Escape", "ArrowDown", "ArrowUp", "Enter"]) {
    assert.match(source, new RegExp(`event\\.key === \\"${key}\\"`));
  }
});

test("species options stay aligned, scroll independently, and can open upward", () => {
  assert.match(styles, /\.sd-species-combobox\s*\{[^}]*position:\s*relative[^}]*width:\s*100%/s);
  assert.match(styles, /\.sd-combobox-list\s*\{[^}]*position:\s*absolute[^}]*left:\s*0[^}]*width:\s*100%[^}]*max-height:[^;]+;[^}]*overflow-y:\s*auto/s);
  assert.match(styles, /\.sd-species-combobox\.opens-upward \.sd-combobox-list\s*\{[^}]*bottom:\s*calc\(100% \+ 4px\)/s);
});
