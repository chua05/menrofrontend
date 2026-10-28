export const MAX_BROWSER_CAMERA_ACCURACY_METERS = 50;

export function isAcceptableBrowserCameraAccuracy(value) {
  const accuracy = Number(value);
  return Number.isFinite(accuracy) && accuracy >= 0 &&
    accuracy <= MAX_BROWSER_CAMERA_ACCURACY_METERS;
}
