export const GOOGLE_POPUP_COMPLETION_TIMEOUT_CODE = "MENRO_GOOGLE_POPUP_TIMEOUT";
export const GOOGLE_POPUP_COMPLETION_TIMEOUT_MS = 45_000;

export function waitForGooglePopupCompletion(
  popupPromise,
  timeoutMs = GOOGLE_POPUP_COMPLETION_TIMEOUT_MS,
) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const error = new Error(
        "Google sign-in did not return to MENRO before the completion timeout.",
      );
      error.code = GOOGLE_POPUP_COMPLETION_TIMEOUT_CODE;
      reject(error);
    }, timeoutMs);

    Promise.resolve(popupPromise).then(
      (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
