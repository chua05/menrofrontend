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

test("global toast provider uses an eight-second default and a body portal", () => {
  assert.match(contextSource, /DEFAULT_TOAST_DURATION\s*=\s*8000/);
  assert.match(contextSource, /document\.querySelectorAll\("\[data-menro-toast-anchor\]"\)/);
  assert.match(contextSource, /document\.querySelector\("\[data-menro-toast-page-anchor\]"\)/);
  assert.match(contextSource, /modalAnchors\.at\(-1\) \|\| pageAnchor[\s\S]*document\.body/);
  assert.match(contextSource, /createPortal\(toastViewport, toastHost\)/);
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
  assert.doesNotMatch(toastCss, /\.menro-toast\s*\{[^}]*\bbackground\s*:/s);
  assert.doesNotMatch(toastCss, /\.menro-toast\s*\{[^}]*\bborder\s*:/s);
  assert.doesNotMatch(toastCss, /\.menro-toast\s*\{[^}]*\bbox-shadow\s*:/s);
});

test("modal alerts use a flow-positioned anchor without permanent empty spacing", () => {
  assert.match(toastCss, /\.menro-toast-anchor:empty[^{}]*\{[^}]*display:\s*none/);
  assert.match(toastCss, /\.menro-toast-viewport-modal\s*\{[^}]*position:\s*static/);
  assert.match(toastCss, /\.menro-toast-viewport-modal\s*\{[^}]*width:\s*100%/);
  assert.match(toastCss, /\.menro-toast-viewport-page\s*\{[^}]*position:\s*static/);
});

test("My Requests consumes and clears route submission feedback", () => {
  assert.match(myRequestsSource, /location\.state\?\.submissionMessage/);
  assert.match(myRequestsSource, /request-submission:/);
  assert.match(myRequestsSource, /replace:\s*true,\s*state:\s*null/);
});
