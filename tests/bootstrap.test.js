import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapApplication, showStartupFailure, STARTUP_MESSAGE } from "../src/bootstrap.js";

function fixture() {
  const documentLike = { createElement: tag => ({ tag, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, append(...children) { this.children = children; } }) };
  const root = { replaceChildren(panel) { this.panel = panel; } };
  return { documentLike, root };
}
test("startup failure has accessible safe text and a same-page recovery link", () => {
  const { root, documentLike } = fixture(); showStartupFailure(root, documentLike);
  assert.equal(root.panel.attributes.role, "alert");
  assert.equal(root.panel.children[1].textContent, STARTUP_MESSAGE);
  assert.equal(root.panel.children[2].href, "");
});
test("successful startup mounts the application exactly once", async () => {
  let mounts = 0; const root = {};
  assert.equal(await bootstrapApplication(async () => ({ mount(target) { assert.equal(target, root); mounts++; } }), root), true);
  assert.equal(mounts, 1);
});
for (const phase of ["import", "mount"]) test(phase + " failure renders fallback and reports the original failure", async () => {
  const { root, documentLike } = fixture(), error = new Error("fixture-only initialization failure"), previous = globalThis.document;
  globalThis.document = documentLike;
  const errors = [];
  try {
    assert.equal(await bootstrapApplication(async () => { if (phase === "import") throw error; return { mount() { throw error; } }; }, root, value => errors.push(value)), false);
    assert.equal(root.panel.attributes.role, "alert"); assert.deepEqual(errors, [error]);
    assert.equal(JSON.stringify(root.panel).includes(error.message), false);
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});
