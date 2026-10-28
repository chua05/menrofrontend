import { test, expect } from "@playwright/test";

async function installCameraMocks(page, { accuracy = 50, denied = false, cameras = 2 } = {}) {
  await page.addInitScript(({ accuracy, denied, cameras }) => {
    window.acceptanceAccuracy = accuracy;
    window.trackStops = 0;
    const tracks = () => [{ stop() { window.trackStops += 1; }, getSettings() { return { deviceId: "camera-1" }; } }];
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      getCurrentPosition(success, failure) {
        if (denied) failure({ code: 1 });
        else success({ coords: { latitude: 12.671, longitude: 123.875, accuracy }, timestamp: Date.now() });
      },
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
  }, { accuracy, denied, cameras });
}

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

test("rejects 51m accuracy and supports retry", async ({ page }) => {
  await installCameraMocks(page, { accuracy: 51 });
  await page.goto("/tests/e2e/fixtures/camera.html");
  await continueToPermissions(page);
  await expect(page.getByRole("alert")).toContainText("50 m or better");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
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
