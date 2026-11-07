export const MAX_BROWSER_CAMERA_ACCURACY_METERS = 50;
export const GPS_ACQUISITION_TIMEOUT_MS = 60000;

const GPS_WATCH_OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

// Number(null) and Number("") are 0, which would read as a perfect fix.
function reportedAccuracy(value) {
  if (value === null || value === undefined) return Number.NaN;
  if (typeof value === "string" && !value.trim()) return Number.NaN;
  return Number(value);
}

export function isAcceptableBrowserCameraAccuracy(value) {
  const accuracy = reportedAccuracy(value);
  return Number.isFinite(accuracy) && accuracy >= 0 &&
    accuracy <= MAX_BROWSER_CAMERA_ACCURACY_METERS;
}

function hasUsableCoordinates(coords) {
  return [coords?.latitude, coords?.longitude].every(value =>
    value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)));
}

function timeoutError(best, timeoutMs) {
  const seconds = Math.round(timeoutMs / 1000);
  const message = best
    ? `Could not reach ${MAX_BROWSER_CAMERA_ACCURACY_METERS} m or better within ${seconds} seconds. Best reading was ${Math.round(best.accuracy)} m. Move to an open area, then try again.`
    : `GPS accuracy was not reported within ${seconds} seconds. Move to an open area, then try again.`;
  return Object.assign(new Error(message), { gpsTimeout: true, bestLocation: best });
}

// GPS accuracy improves over several seconds, so one poor first reading is not a failure.
export function acquirePreciseLocation({
  geolocation = globalThis.navigator?.geolocation,
  onProgress,
  signal,
  timeoutMs = GPS_ACQUISITION_TIMEOUT_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!geolocation?.watchPosition) return reject(new Error("UNSUPPORTED_LOCATION"));
    let watchId, timer, best = null, lastError = null, finished = false;
    const finish = (settle, value) => {
      if (finished) return;
      finished = true;
      clearTimer(timer);
      signal?.removeEventListener("abort", abort);
      if (watchId !== undefined) geolocation.clearWatch(watchId);
      settle(value);
    };
    function abort() {
      finish(reject, Object.assign(new Error("Location acquisition cancelled."), { name: "AbortError" }));
    }
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort);
    timer = setTimer(() => finish(reject, !best && lastError ? lastError : timeoutError(best, timeoutMs)), timeoutMs);
    const id = geolocation.watchPosition(position => {
      if (finished) return;
      const { coords } = position;
      const accuracy = reportedAccuracy(coords?.accuracy);
      const usable = hasUsableCoordinates(coords);
      if (usable && Number.isFinite(accuracy) && accuracy >= 0 && (!best || accuracy < best.accuracy)) {
        best = { latitude: Number(coords.latitude), longitude: Number(coords.longitude), accuracy,
          capturedAt: new Date(position.timestamp || Date.now()).toISOString() };
      }
      onProgress?.({ accuracy: Number.isFinite(accuracy) ? accuracy : null });
      if (usable && isAcceptableBrowserCameraAccuracy(coords?.accuracy)) finish(resolve, position);
    }, error => {
      if (error?.code === 1) return finish(reject, error);
      lastError = error;
    }, GPS_WATCH_OPTIONS);
    if (finished) geolocation.clearWatch(id);
    else watchId = id;
  });
}
