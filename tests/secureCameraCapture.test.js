import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MAX_BROWSER_CAMERA_ACCURACY_METERS,
  isAcceptableBrowserCameraAccuracy,
} from "../src/utils/cameraCapturePolicy.js";

const component = readFileSync(new URL("../src/components/SecureCameraCapture.jsx", import.meta.url), "utf8");
const planting = readFileSync(new URL("../src/pages/PlantingPage.jsx", import.meta.url), "utf8");
const monitoring = readFileSync(new URL("../src/pages/MonitoringPage.jsx", import.meta.url), "utf8");

test("secure camera requests media and precise location and cleans every track", () => {
  assert.match(component, /mediaDevices\?\.getUserMedia/);
  assert.match(component, /enableHighAccuracy:\s*true/);
  assert.match(component, /isAcceptableBrowserCameraAccuracy/);
  assert.match(component, /Continue to Camera &amp; Location/);
  assert.match(component, /navigator\.permissions\?\.query/);
  assert.match(component, /Android Chrome/);
  assert.match(component, /iOS Safari/);
  assert.equal(MAX_BROWSER_CAMERA_ACCURACY_METERS, 50);
  assert.equal(isAcceptableBrowserCameraAccuracy(49), true);
  assert.equal(isAcceptableBrowserCameraAccuracy(50), true);
  assert.equal(isAcceptableBrowserCameraAccuracy(51), false);
  assert.match(component, /getTracks\?\.\(\)\.forEach\(track => track\.stop\(\)\)/);
});

test("capture supports capture, retake, cancel, switching, hashing, and backend verification", () => {
  for (const text of ["Capture", "Retake", "Cancel", "Switch Camera", "SHA-256", "clientImageSha256"])
    assert.match(component, new RegExp(text.replace("-", "\\-")));
  assert.match(component, /evidence-capture-sessions\/\$\{session\.captureSessionId\}\/verify/);
});

test("planting and monitoring retain separate original-upload inputs and camera manifests", () => {
  for (const source of [planting, monitoring]) {
    assert.match(source, /SecureCameraCapture/);
    assert.match(source, /uploaded-original/);
    assert.match(source, /evidenceManifest/);
  }
  assert.match(component, /source:\s*"browser-camera"/);
  assert.doesNotMatch(component, /GPSLatitude|GPSLongitude|EXIF/i);
});
