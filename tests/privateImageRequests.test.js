import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers";
import { privateImageRequest } from "../src/utils/privateImageRequests.js";
test("concurrent gallery and submission thumbnails share a read only for the same authenticated user", async () => {
  let count = 0, release;
  const first = privateImageRequest("owner", "/owned-photo", () => { count++; return new Promise(resolve => { release = resolve; }); });
  const second = privateImageRequest("owner", "/owned-photo", () => { throw new Error("Duplicate read"); });
  assert.equal(first, second); await Promise.resolve(); assert.equal(count, 1);
  const other = privateImageRequest("admin", "/owned-photo", async () => "separate authorized request");
  assert.equal(await other, "separate authorized request"); release("bytes"); assert.equal(await first, "bytes");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await privateImageRequest("owner", "/owned-photo", async () => "fresh authorization"), "fresh authorization");
});
test("private image reads are bounded and a failure never becomes a cached success", async () => {
  let active = 0, peak = 0;
  const results = Array.from({ length: 5 }, (_, index) => privateImageRequest("owner", `/bounded-${index}`, async () => {
    active++; peak = Math.max(peak, active); await new Promise(resolve => setImmediate(resolve)); active--; return index;
  }));
  assert.deepEqual(await Promise.all(results), [0, 1, 2, 3, 4]); assert.equal(peak, 2);
  await assert.rejects(privateImageRequest("owner", "/retry-photo", async () => { throw new Error("Unavailable"); }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await privateImageRequest("owner", "/retry-photo", async () => "retried"), "retried");
  await assert.rejects(privateImageRequest(null, "/owned-photo", () => { throw new Error("Must not read"); }), /Authentication/);
});
