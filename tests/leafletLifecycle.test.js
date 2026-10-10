import test from "node:test";
import assert from "node:assert/strict";
import { createLeafletResizeScheduler } from "../src/utils/leafletLifecycle.js";

function frameHarness() {
  const callbacks = new Map();
  let nextHandle = 0;
  return {
    callbacks,
    requestFrame(callback) {
      const handle = ++nextHandle;
      callbacks.set(handle, callback);
      return handle;
    },
    cancelFrame(handle) {
      callbacks.delete(handle);
    },
    flush() {
      for (const [handle, callback] of [...callbacks]) {
        callbacks.delete(handle);
        callback();
      }
    },
  };
}

test("Leaflet resize is cancelled when the map unmounts", () => {
  const frames = frameHarness();
  let invalidations = 0;
  const scheduler = createLeafletResizeScheduler(frames);
  const map = {
    getContainer: () => ({ isConnected: true }),
    invalidateSize: () => { invalidations += 1; },
  };

  scheduler.schedule(map, () => true);
  scheduler.dispose();
  frames.flush();

  assert.equal(invalidations, 0);
});

test("stale or detached Leaflet maps are never resized", () => {
  const frames = frameHarness();
  let invalidations = 0;
  const scheduler = createLeafletResizeScheduler(frames);
  const map = {
    getContainer: () => ({ isConnected: false }),
    invalidateSize: () => { invalidations += 1; },
  };

  scheduler.schedule(map, () => false);
  frames.flush();

  assert.equal(invalidations, 0);
});

test("a remounted Leaflet map receives one current resize", () => {
  const frames = frameHarness();
  let oldInvalidations = 0;
  let newInvalidations = 0;
  const scheduler = createLeafletResizeScheduler(frames);
  const oldMap = {
    getContainer: () => ({ isConnected: true }),
    invalidateSize: () => { oldInvalidations += 1; },
  };
  const newMap = {
    getContainer: () => ({ isConnected: true }),
    invalidateSize: () => { newInvalidations += 1; },
  };

  scheduler.schedule(oldMap, () => false);
  scheduler.schedule(newMap, () => true);
  frames.flush();

  assert.equal(oldInvalidations, 0);
  assert.equal(newInvalidations, 1);
});
