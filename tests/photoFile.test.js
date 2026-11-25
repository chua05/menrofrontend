import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSupportedPhotoFile, photoAccept, photoMetadataProblem, readPhoto } from "../src/utils/photoFile.js";

const file = bytes => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer });
test("Android gets no image-only filter (its photo picker blanks GPS); other devices are offered HEIC too", () => {
  assert.equal(photoAccept("Mozilla/5.0 (Linux; Android 14; SM-S911B) Chrome/130"), undefined);
  assert.match(photoAccept("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), /\.heic/);
});
test("a HEIC file is supported with or without a type; other files are not", () => {
  for (const value of [{ type: "image/heic", name: "a" }, { type: "", name: "IMG_1.HEIC" }, { type: "application/octet-stream", name: "a.heif" }, { type: "image/jpeg", name: "a" }]) assert.equal(isSupportedPhotoFile(value), true);
  for (const value of [{ type: "", name: "a.txt" }, { type: "image/gif", name: "a.gif" }, { type: "application/pdf", name: "a.heic" }, undefined]) assert.equal(isSupportedPhotoFile(value), false);
});
test("each metadata problem has its own message", async () => {
  const problem = (metadataStatus, gps) => photoMetadataProblem({ metadataStatus, gps });
  assert.equal(problem("ok", { status: "valid" }), null);
  assert.match(problem("unsupported", { status: "missing" }).message, /format could not be processed/);
  assert.match(problem("malformed", { status: "unparseable" }).message, /metadata could not be read/);
  assert.match(problem("ok", { status: "unparseable" }).label, /GPS Metadata Unreadable/);
  assert.match(problem("ok", { status: "invalid" }).label, /Invalid GPS/);
  assert.match(problem("ok", { status: "missing" }).message, /does not contain GPS coordinates/);
  assert.match(problem("ok", { status: "missing", removed: true }).message, /phone removed them/);
  assert.equal(photoMetadataProblem(await readPhoto(file([1, 2, 3]))).status, "unsupported");
  assert.equal(photoMetadataProblem(await readPhoto(file([0xff, 0xd8, 0xff, 0xd9]))).status, "missing");
});
test("the preview parser keeps the safety limits of the server's parser", () => {
  const source = readFileSync(new URL("../src/utils/photoMetadata.js", import.meta.url), "utf8");
  for (const rule of ["MAX_BOXES = 4096", "includes(\"avif\")", "MANILA_OFFSET_MINUTES = 8 * 60"]) assert.ok(source.includes(rule), rule);
});
