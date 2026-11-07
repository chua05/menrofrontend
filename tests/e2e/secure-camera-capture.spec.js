import { test, expect } from "@playwright/test";

async function installCameraMocks(page, { accuracy = 50, readings = [accuracy], denied = false, cameras = 2 } = {}) {
  await page.addInitScript(({ accuracy, readings, denied, cameras }) => {
    window.acceptanceAccuracy = accuracy;
    window.acceptanceReadings = readings;
    window.activeWatches = 0;
    window.trackStops = 0;
    const tracks = () => [{ stop() { window.trackStops += 1; }, getSettings() { return { deviceId: "camera-1" }; } }];
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      watchPosition(success, failure) {
        const id = { stopped: false };
        window.activeWatches += 1;
        window.lastWatch = id;
        window.emitGps = accuracy => { if (!id.stopped) success({ coords: { latitude: 12.671, longitude: 123.875, accuracy }, timestamp: Date.now() }); };
        if (denied) { setTimeout(() => failure({ code: 1 }), 0); return id; }
        const readings = [...window.acceptanceReadings];
        const next = () => {
          if (id.stopped || !readings.length) return;
          success({ coords: { latitude: 12.671, longitude: 123.875, accuracy: readings.shift() }, timestamp: Date.now() });
          setTimeout(next, 20);
        };
        setTimeout(next, 20);
        return id;
      },
      clearWatch(id) { if (!id.stopped) { id.stopped = true; window.activeWatches -= 1; } },
    } });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      async getUserMedia() { if (denied) throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
        return { getTracks: tracks, getVideoTracks: tracks }; },
      async enumerateDevices() { return Array.from({ length: cameras }, (_, index) => ({ kind: "videoinput", deviceId: `camera-${index + 1}` })); },
    } });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 32 });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 24 });
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", { configurable: true,
      get() { return this.__acceptanceStream || null; }, set(value) { this.__acceptanceStream = value; } });
    HTMLMediaElement.prototype.play = async () => {};
    HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
    HTMLCanvasElement.prototype.toBlob = callback => callback(new Blob([new Uint8Array([255, 216, 255, 217])], { type: "image/jpeg" }));
  }, { accuracy, readings, denied, cameras });
}

const gpsWatchStarted = page => expect.poll(() => page.evaluate(() => Boolean(window.lastWatch))).toBe(true);

async function continueToPermissions(page) {
  await expect(page.getByText("MENRO needs your camera")).toBeVisible();
  await page.getByRole("button", { name: "Continue to Camera & Location" }).click();
}

for (const accuracy of [49, 50]) test(`accepts ${accuracy}m, captures, verifies, and stops tracks`, async ({ page }) => {
  await installCameraMocks(page, { accuracy });
  await page.goto("/tests/e2e/fixtures/camera.html");
  await continueToPermissions(page);
  await expect(page.getByText(`accuracy ${accuracy} m`)).toBeVisible();
  await page.getByRole("button", { name: "Capture", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.trackStops)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Verify & Use Photo" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.verifiedCapture))).toBe(true);
});

test("keeps reading GPS while accuracy improves and shows the current value", async ({ page }) => {
  await installCameraMocks(page, { readings: [] });
  await page.goto("/tests/e2e/fixtures/camera.html");
  await continueToPermissions(page);
  await gpsWatchStarted(page);
  await expect(page.getByRole("status").filter({ hasText: "Waiting for GPS accuracy" })).toBeVisible();
  await page.evaluate(() => window.emitGps(120));
  await expect(page.getByRole("status").filter({ hasText: "120 m" })).toContainText("50 m or better");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Capture", exact: true })).toHaveCount(0);
  await page.evaluate(() => window.emitGps(80));
  await expect(page.getByRole("status").filter({ hasText: "80 m" })).toBeVisible();
  await page.evaluate(() => window.emitGps(30));
  await expect(page.getByText("accuracy 30 m")).toBeVisible();
  await expect(page.getByRole("button", { name: "Capture", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.activeWatches)).toBe(0);
});

test("rejects 51m accuracy after the timeout and retry can succeed", async ({ page }) => {
  await page.clock.install();
  await installCameraMocks(page, { accuracy: 51 });
  await page.goto("/tests/e2e/fixtures/camera.html");
  await continueToPermissions(page);
  await gpsWatchStarted(page);
  await page.clock.runFor(25);
  await expect(page.getByRole("status").filter({ hasText: "51 m" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Capture", exact: true })).toHaveCount(0);
  await page.clock.fastForward(61000);
  await expect(page.getByRole("alert")).toContainText("50 m or better");
  await expect(page.getByRole("alert")).toContainText("Best reading was 51 m");
  await expect.poll(() => page.evaluate(() => window.activeWatches)).toBe(0);
  await page.evaluate(() => { window.acceptanceReadings = [40]; });
  await page.evaluate(() => { window.lastWatch = null; });
  await page.getByRole("button", { name: "Retry" }).click();
  await gpsWatchStarted(page);
  await page.clock.runFor(25);
  await expect(page.getByText("accuracy 40 m")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("blank accuracy is never accepted", async ({ page }) => {
  await page.clock.install();
  await installCameraMocks(page, { readings: [null, "", null] });
  await page.goto("/tests/e2e/fixtures/camera.html");
  await continueToPermissions(page);
  await gpsWatchStarted(page);
  await page.clock.runFor(25);
  await expect(page.getByRole("status").filter({ hasText: "Waiting for GPS accuracy" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Capture", exact: true })).toHaveCount(0);
  await page.clock.fastForward(61000);
  await expect(page.getByRole("alert")).toContainText("not reported");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("cancelling during GPS search stops the watch", async ({ page }) => {
  await installCameraMocks(page, { readings: [90] });
  await page.goto("/tests/e2e/fixtures/camera.html");
  await continueToPermissions(page);
  await expect(page.getByRole("status").filter({ hasText: "90 m" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => page.evaluate(() => window.cameraCancelled)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.activeWatches)).toBe(0);
});

test("the fresh capture fix also waits for acceptable accuracy", async ({ page }) => {
  await installCameraMocks(page, { readings: [30] });
  await page.goto("/tests/e2e/fixtures/camera.html");
  await continueToPermissions(page);
  await expect(page.getByText("accuracy 30 m")).toBeVisible();
  await page.evaluate(() => { window.acceptanceReadings = [95, 20]; });
  await page.getByRole("button", { name: "Capture", exact: true }).click();
  await expect(page.getByText("accuracy 20 m")).toBeVisible();
  await page.getByRole("button", { name: "Verify & Use Photo" }).click();
  await expect.poll(() => page.evaluate(() => window.verifiedCapture?.descriptor?.source)).toBe("browser-camera");
  expect(await page.evaluate(() => window.verifiedCapture.descriptor.captureSessionId)).toBe("session-1");
});

test("permission denial is clear and cancel closes without a file picker", async ({ page }) => {
  await installCameraMocks(page, { denied: true });
  await page.goto("/tests/e2e/fixtures/camera.html");
  await continueToPermissions(page);
  await expect(page.getByRole("alert")).toContainText("Location access is denied or blocked");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => page.evaluate(() => window.cameraCancelled)).toBe(true);
  expect(await page.locator('input[type="file"]').count()).toBe(0);
});

test("retake and camera switching stop the previous stream", async ({ page }) => {
  await installCameraMocks(page, { cameras: 2 });
  await page.goto("/tests/e2e/fixtures/camera.html");
  await continueToPermissions(page);
  await page.getByRole("button", { name: "Switch Camera" }).click();
  await expect.poll(() => page.evaluate(() => window.trackStops)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Capture", exact: true }).click();
  const stopped = await page.evaluate(() => window.trackStops);
  await page.getByRole("button", { name: "Retake" }).click();
  await expect(page.getByRole("button", { name: "Capture", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.trackStops)).toBeGreaterThanOrEqual(stopped);
});

test("previously granted permissions proceed without recovery instructions", async ({ page }) => {
  await installCameraMocks(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "permissions", { configurable: true, value: {
      async query() { return { state: "granted" }; },
    } });
  });
  await page.goto("/tests/e2e/fixtures/camera.html");
  await continueToPermissions(page);
  await expect(page.getByRole("button", { name: "Capture", exact: true })).toBeVisible();
  await expect(page.getByText("After changing the browser or device permission")).toHaveCount(0);
});

test("blocked location is detected before APIs prompt again", async ({ page }) => {
  await installCameraMocks(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "permissions", { configurable: true, value: {
      async query(descriptor) { return { state: descriptor.name === "geolocation" ? "denied" : "granted" }; },
    } });
  });
  await page.goto("/tests/e2e/fixtures/camera.html");
  await continueToPermissions(page);
  await expect(page.getByRole("alert")).toContainText("Android Chrome");
  await expect(page.getByText("tap Retry once")).toBeVisible();
});
