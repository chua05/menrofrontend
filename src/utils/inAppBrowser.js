export const GOOGLE_IN_APP_BROWSER_MESSAGE =
  "For Google sign-in, open MENRO in Chrome first. In Messenger, tap ⋯ → Open in browser, then continue with Google.";

// User-agent detection is intentionally narrow: it only offers recovery
// guidance for known Meta in-app browsers and never claims to detect all
// embedded browsers.
export function isLikelyInAppBrowser(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
) {
  return /(?:FBAN|FBAV|FB_IAB|Messenger|Instagram)/i.test(String(userAgent));
}
