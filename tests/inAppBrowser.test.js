import assert from "node:assert/strict";
import test from "node:test";

import {
  GOOGLE_IN_APP_BROWSER_MESSAGE,
  isLikelyInAppBrowser,
} from "../src/utils/inAppBrowser.js";

test("detects known Meta in-app browser markers without classifying Chrome as embedded", () => {
  assert.equal(isLikelyInAppBrowser("Mozilla/5.0 [FB_IAB/MESSENGER;FBAV/450.0]"), true);
  assert.equal(isLikelyInAppBrowser("Mozilla/5.0 (Linux; Android 13) Chrome/120.0 Mobile Safari/537.36"), false);
});

test("in-app browser recovery guidance gives the Messenger Chrome recovery path", () => {
  assert.match(GOOGLE_IN_APP_BROWSER_MESSAGE, /open MENRO in Chrome first/i);
  assert.match(GOOGLE_IN_APP_BROWSER_MESSAGE, /Open in browser/i);
});
