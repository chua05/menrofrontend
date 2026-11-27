import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const contextSource = readFileSync(
  new URL("../src/context/ToastContext.jsx", import.meta.url),
  "utf8",
);
const toastCss = readFileSync(
  new URL("../src/styles/toast.css", import.meta.url),
  "utf8",
);
const myRequestsSource = readFileSync(
  new URL("../src/pages/MyRequestsPage.jsx", import.meta.url),
  "utf8",
);

test("global toast provider uses an eight-second default and one top-layer portal, never an in-page anchor", () => {
  assert.match(contextSource, /DEFAULT_TOAST_DURATION\s*=\s*8000/);
  assert.match(contextSource, /document\.querySelectorAll\("dialog\[open\]"\)/);
  assert.match(contextSource, /const host = topmostOpenDialog\(\) \|\| document\.body;/);
  assert.match(contextSource, /host\.appendChild\(container\)/);
  assert.match(contextSource, /useLayoutEffect\(\(\) => \{\s*if \(!container \|\| !active\) return;/);
  assert.equal((contextSource.match(/createPortal\(/g) || []).length, 1);
  assert.doesNotMatch(contextSource, /toast-anchor|toast-page-anchor/);
  assert.match(contextSource, /MAX_VISIBLE_TOASTS = 3/);
});

test("toast queue deduplicates active messages and cleans up timers", () => {
  assert.match(contextSource, /activeKeys\.current\.get\(key\)/);
  assert.match(contextSource, /if \(existingId\) return existingId/);
  assert.match(contextSource, /for \(const timer of timers\.current\.values\(\)\) window\.clearTimeout\(timer\)/);
});

test("toast visibility waits for the triggering UI paint before starting dismissal", () => {
  assert.match(contextSource, /requestAnimationFrame\(\(\) =>[\s\S]*requestAnimationFrame\(makeVisible\)/);
  assert.match(contextSource, /const makeVisible = \(\) => \{[\s\S]*setToasts[\s\S]*setTimeout\(\(\) => dismiss\(id\), duration\)/);
  assert.match(contextSource, /scheduledFrames\.current\.clear\(\)/);
});

test("toast viewport overlays content and honors reduced motion", () => {
  assert.match(toastCss, /position:\s*fixed/);
  assert.match(toastCss, /z-index:\s*var\(--menro-overlay-toast\)/);
  assert.match(toastCss, /pointer-events:\s*none/);
  assert.match(toastCss, /prefers-reduced-motion:\s*reduce/);
  // Regular alerts are text only.
  const regular = toastCss.match(/(?:^|\n)\.menro-toast\s*\{([^}]*)\}/)[1];
  assert.match(regular, /\bborder:\s*0;/);
  assert.match(regular, /\bbackground:\s*transparent;/);
  assert.match(regular, /\bbox-shadow:\s*none;/);
});

test("alerts never take part in page or modal layout", () => {
  assert.doesNotMatch(toastCss, /position:\s*static/);
  assert.doesNotMatch(toastCss, /menro-toast-anchor|menro-toast-page-anchor|viewport-modal|viewport-page/);
  assert.match(toastCss, /safe-area-inset-top/);
  assert.match(toastCss, /max-height:\s*calc\(100dvh/);
});

test("My Requests consumes and clears route submission feedback", () => {
  assert.match(myRequestsSource, /location\.state\?\.submissionMessage/);
  assert.match(myRequestsSource, /request-submission:/);
  assert.match(myRequestsSource, /replace:\s*true,\s*state:\s*null/);
});
