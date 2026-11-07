import test from "node:test";
import assert from "node:assert/strict";
import { GPS_ACQUISITION_TIMEOUT_MS, MAX_BROWSER_CAMERA_ACCURACY_METERS, acquirePreciseLocation, isAcceptableBrowserCameraAccuracy } from "../src/utils/cameraCapturePolicy.js";
import { buildEvidenceLocationView, photoGpsMetadataLabel } from "../src/utils/evidenceLocationView.js";

function fakeGps() {
  const gps = { cleared: [], success: null, failure: null, nextId: 1,
    watchPosition(success, failure, options) { gps.success = success; gps.failure = failure; gps.options = options; return gps.nextId++; },
    clearWatch(id) { gps.cleared.push(id); },
    fix(accuracy, latitude = 12.67, longitude = 123.87) { gps.success({ coords: { latitude, longitude, accuracy }, timestamp: 1 }); },
  };
  return gps;
}
function fakeTimer() {
  const timer = { fire: null, cleared: false, delay: null,
    set(callback, delay) { timer.fire = callback; timer.delay = delay; return 1; },
    clear() { timer.cleared = true; } };
  return timer;
}
const start = (gps, timer, extra = {}) => acquirePreciseLocation({ geolocation: gps, setTimer: timer.set, clearTimer: timer.clear, ...extra });

test("the 50 metre limit is unchanged", () => {
  assert.equal(MAX_BROWSER_CAMERA_ACCURACY_METERS, 50);
  for (const accuracy of [0, 49, 50, "50"]) assert.equal(isAcceptableBrowserCameraAccuracy(accuracy), true, String(accuracy));
  assert.equal(isAcceptableBrowserCameraAccuracy(51), false);
});

test("missing or blank accuracy is never treated as a perfect reading", () => {
  for (const accuracy of [null, undefined, "", "   ", NaN, "unknown", -1, Infinity]) {
    assert.equal(isAcceptableBrowserCameraAccuracy(accuracy), false, String(accuracy));
  }
});

test("poor readings keep waiting until one meets the limit", async () => {
  const gps = fakeGps(), timer = fakeTimer(), progress = [];
  const result = start(gps, timer, { onProgress: value => progress.push(value.accuracy) });
  gps.fix(120); gps.fix(80); gps.fix(30);
  const position = await result;
  assert.equal(position.coords.accuracy, 30);
  assert.deepEqual(progress, [120, 80, 30]);
  assert.deepEqual(gps.cleared, [1]); assert.equal(timer.cleared, true);
});

test("each fix is requested fresh and at high accuracy", async () => {
  const gps = fakeGps(), result = start(gps, fakeTimer());
  gps.fix(10); await result;
  assert.equal(gps.options.enableHighAccuracy, true);
  assert.equal(gps.options.maximumAge, 0);
});

test("a blank accuracy keeps waiting and reports no accuracy", async () => {
  const gps = fakeGps(), progress = [], result = start(gps, fakeTimer(), { onProgress: value => progress.push(value.accuracy) });
  gps.fix(null); gps.fix(""); gps.fix(undefined); gps.fix(20);
  assert.equal((await result).coords.accuracy, 20);
  assert.deepEqual(progress, [null, null, null, 20]);
});

test("a reading with unusable coordinates is not accepted", async () => {
  const gps = fakeGps(), result = start(gps, fakeTimer());
  gps.fix(10, NaN, 123); gps.fix(10, 12.67, null); gps.fix(15);
  assert.equal((await result).coords.accuracy, 15);
});

test("timing out reports the best reading and stops watching", async () => {
  const gps = fakeGps(), timer = fakeTimer(), result = start(gps, timer);
  gps.fix(120); gps.fix(73); gps.fix(90);
  assert.equal(timer.delay, GPS_ACQUISITION_TIMEOUT_MS);
  timer.fire();
  await assert.rejects(result, error => error.gpsTimeout === true && error.bestLocation.accuracy === 73 &&
    /Best reading was 73 m/.test(error.message) && /50 m or better/.test(error.message));
  assert.deepEqual(gps.cleared, [1]);
});

test("timing out with only blank readings says accuracy was not reported", async () => {
  const gps = fakeGps(), timer = fakeTimer(), result = start(gps, timer);
  gps.fix(null); timer.fire();
  await assert.rejects(result, error => error.gpsTimeout === true && !error.bestLocation && /not reported/.test(error.message));
});

test("a denied permission fails at once", async () => {
  const gps = fakeGps(), result = start(gps, fakeTimer());
  gps.failure({ code: 1 });
  await assert.rejects(result, error => error.code === 1);
  assert.deepEqual(gps.cleared, [1]);
});

test("temporary GPS errors keep trying", async () => {
  const gps = fakeGps(), result = start(gps, fakeTimer());
  gps.failure({ code: 2 }); gps.failure({ code: 3 }); gps.fix(25);
  assert.equal((await result).coords.accuracy, 25);
});

test("a temporary error with no reading is surfaced after the timeout", async () => {
  const gps = fakeGps(), timer = fakeTimer(), result = start(gps, timer);
  gps.failure({ code: 2 }); timer.fire();
  await assert.rejects(result, error => error.code === 2);
});

test("cancelling stops the watch without reporting a failure", async () => {
  const gps = fakeGps(), timer = fakeTimer(), controller = new AbortController();
  const result = start(gps, timer, { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, error => error.name === "AbortError");
  assert.deepEqual(gps.cleared, [1]); assert.equal(timer.cleared, true);
});

test("a fix delivered during setup still clears the watch", async () => {
  const gps = fakeGps();
  gps.watchPosition = (success) => { success({ coords: { latitude: 12.67, longitude: 123.87, accuracy: 5 }, timestamp: 1 }); return 7; };
  await start(gps, fakeTimer());
  assert.deepEqual(gps.cleared, [7]);
});

test("a browser without geolocation fails clearly", async () => {
  await assert.rejects(acquirePreciseLocation({ geolocation: null }), /UNSUPPORTED_LOCATION/);
});

test("a camera location with blank accuracy is not shown as valid", () => {
  for (const accuracy of [null, "", undefined]) {
    assert.equal(buildEvidenceLocationView({ gpsStatus: "valid", latitude: 12.67, longitude: 123.87, accuracy, evidenceSource: "browser-camera" }).code, "low_accuracy");
  }
});

test("EXIF photos may legitimately have no accuracy", () => {
  assert.equal(buildEvidenceLocationView({ gpsStatus: "valid", latitude: 12.67, longitude: 123.87, accuracy: null, evidenceSource: "original-exif" }).code, "valid");
});

test("verified camera photos are not reported as missing EXIF GPS", () => {
  const camera = { locationSource: "Browser Capture Session", gpsMetadataPresent: false };
  assert.equal(photoGpsMetadataLabel({ gpsMetadataPresent: false, photos: [camera] }), "Not required — verified camera capture");
  assert.equal(photoGpsMetadataLabel({ gpsMetadataPresent: false, photos: [{ evidenceSource: "browser-camera", gpsMetadataPresent: false }] }), "Not required — verified camera capture");
  assert.equal(photoGpsMetadataLabel({ gpsMetadataPresent: false, locationSource: "Browser Capture Session" }), "Not required — verified camera capture");
});

test("a mixed report is judged only on its uploaded photos", () => {
  const camera = { locationSource: "Browser Capture Session", gpsMetadataPresent: false };
  const present = { locationSource: "Photo Metadata (EXIF)", gpsMetadataPresent: true };
  const missing = { locationSource: "Photo Metadata (EXIF)", gpsMetadataPresent: false };
  assert.equal(photoGpsMetadataLabel({ gpsMetadataPresent: false, photos: [camera, present] }), "Present");
  assert.equal(photoGpsMetadataLabel({ gpsMetadataPresent: false, photos: [camera, missing] }), "Missing");
});

test("uploaded photos keep their EXIF result", () => {
  assert.equal(photoGpsMetadataLabel({ gpsMetadataPresent: true }), "Present");
  assert.equal(photoGpsMetadataLabel({ gpsMetadataPresent: false, photos: [{ gpsMetadataPresent: false }] }), "Missing");
  assert.equal(photoGpsMetadataLabel({ gpsMetadataPresent: false }), "Missing");
  assert.equal(photoGpsMetadataLabel({}), "—");
});
