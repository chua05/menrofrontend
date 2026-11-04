import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

export default function realTeardown() {
  assert.equal(process.env.MENRO_PHASE3C_ISOLATED_EMULATORS, "true");
  const fixturePath = path.join(os.tmpdir(), "menro-phase3c-browser-fixture.json");
  if (!existsSync(fixturePath)) return;
  const { prefix, project } = JSON.parse(readFileSync(fixturePath, "utf8"));
  assert.equal(project, "demo-menro-phase3c-isolated");
  assert.match(prefix, /^phase3c-browser-[0-9a-f-]{36}$/);
  for (let pass = 0; pass < 2; pass += 1) {
    const result = spawnSync(process.execPath, ["tests/integration/phase3cBrowserCleanup.js", prefix], {
      cwd: "C:/Users/chuak/Desktop/menrobackend-phase3b-per-tree-evidence",
      env: { ...process.env, NODE_PATH: "C:/Users/chuak/Desktop/menrobackend/node_modules",
        MENRO_VERIFY_RELEASE_NO_WRITES: pass === 0 && process.env.MENRO_RELEASE_PAUSE_EXPECTED === "true" ? "true" : "false" },
      encoding: "utf8", windowsHide: true, timeout: 30000,
    });
    assert.equal(result.status, 0, "Explicit isolated UUID fixture cleanup failed");
  }
}
