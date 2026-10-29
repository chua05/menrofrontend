export const GOOGLE_IN_APP_BROWSER_MESSAGE =
  "Google sign-in must start and finish in the same browser. In Messenger, tap ⋮, choose Open in browser or Open in Chrome, then open MENRO there before continuing with Google.";

// User-agent detection is intentionally narrow: it only offers recovery
// guidance for known Meta in-app browsers and never claims to detect all
// embedded browsers.
export function isLikelyInAppBrowser(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
) {
  return /(?:FBAN|FBAV|FB_IAB|Messenger|Instagram)/i.test(String(userAgent));
}
