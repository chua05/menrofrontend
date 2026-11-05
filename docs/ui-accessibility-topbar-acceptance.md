# Release dialog, sidebar and topbar audit — 2026-11-05

## Findings and changes

Before the fix, browser interaction tests proved that opening Release Seedlings left focus on the background trigger, and closing sidebar navigation left the focused link inside `aria-hidden="true"`. The closed sidebar also lacked `inert`. The exact Chromium “Blocked aria-hidden” log text was not emitted in the clean browser, even when observing both console events and Chromium Log events; the invalid focused-hidden DOM condition itself was reproduced.

`src/components/ModalDialog.jsx` now uses native `showModal()` background isolation, explicit Tab/Shift+Tab wrapping, Escape/backdrop dismissal and focus restoration before callers hide contents. Background page controls cannot receive focus while the modal is active. The sidebar retains its accessibility attributes and is inert when closed. Release actions cannot dismiss the dialog while a write is pending. If a successful release removes its trigger, focus returns to the existing request-details Close control. Body scroll state is restored on close/unmount.

Release inventory loading already settles in `finally` on success/error. Tests now verify the pending state, accessible stock-load failure, successful release, HTTP 409 failure and busy-state duplicate prevention. Only modal markup, status announcements and accessibility state changed: existing release handlers, quantities, expectedVersion payloads, authorization, inventory transactions and idempotency behavior were preserved. No backend source changed.

The shared topbar uses `--menro-forest: #145b3a`, a white search surface, white/light-green identity/icons, light-green avatars with dark-green initials, a high-contrast gold unread badge, and visible hover/focus/active states. Its color is scoped to `.dashboard-shell .topbar` with an explicit forest-green fallback; responsive dimension rules retain their original specificity. Admin, Staff and Participant use the same component. Sticky placement and responsive dimensions are retained.

## White-header diagnosis and dashboard verification

The reported URL was `http://localhost:5173/participant/dashboard`. Read-only listener/process inspection identified port 5173 as PID 37876, running Vite from the **original** `C:\Users\chuak\Desktop\menrosystem\node_modules` checkout, not the requested Phase 3C worktree. That original checkout's `dashboard-shell.css` still specifies `rgba(255,255,255,0.97)` for the header. No request was made to that server, no process was stopped/reconfigured, and no original-checkout source was changed.

The earlier tests exercised request pages, leaving a dashboard-route coverage gap. New tests now mount the real App and shared header on `/admin/dashboard`, `/staff/dashboard` and `/participant/dashboard`, using isolated authenticated role fixtures and mocked localhost APIs, not production Firebase. All three computed backgrounds equal `rgb(20,91,58)` before/after reload and on mobile. Negative CSS checks verify that a later generic white `.topbar` rule cannot override the shell color, and that the fallback remains green if the custom property is unavailable. Desktop/mobile screenshots for each dashboard were visually inspected. There is no role-specific header or white override in the requested worktree.

## Files

- Production: `src/components/ModalDialog.jsx`, `src/layouts/DashboardLayout.jsx`, `src/layouts/Sidebar.jsx`, `src/layouts/Topbar.jsx`, `src/pages/SeedlingRequestsPage.jsx`, `src/styles/dashboard-shell.css`.
- Test-only: `playwright.ui-a11y.config.js`, `vite.ui-a11y-test.config.js`, `tests/e2e/modal-topbar.spec.js`.
- This report. Generated graph updates remain separate and uncommitted.

## Executed acceptance

| Check | Result |
|---|---|
| Modal/topbar and actual dashboard-route Playwright | 12/12 PASS, zero unexpected/flaky/skipped tests |
| Existing request/planting browser workflows | 10/10 PASS |
| Existing monitoring/navigation browser workflows | 25/25 PASS |
| Frontend root unit/safety suites | 195/195 PASS |
| Backend connected/release workflow | 24/24 PASS |
| Backend inventory batch/notification regressions | 5/5 and 4/4 PASS |
| Scoped ESLint | PASS |
| Normal Vite production build | PASS; existing large-bundle warning |
| Diff check | PASS |

Focused command: `npx playwright test --config playwright.ui-a11y.config.js --reporter=list,json`, with `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/ui-a11y-results.json`. The report, mobile screenshots and measured contrast evidence are ignored local artifacts. Tests use the real React components, deterministic auth/API boundaries and blocked external requests. The dedicated UI config adds the production entry's CSS imports; the older mock entry omitted its reset/fonts, so it was unsuitable for pixel sizing. Normal Vite and other test configurations are unchanged.

Assertions cover opening, Escape, Cancel/Close, exact Tab boundary wrapping, navigation and trigger restoration, inability to focus hidden sidebar/background controls, loading/error/success, prevention of duplicate release while pending, role-specific shared header rendering, search/clear/Escape, notification filtering, profile dropdown, sticky position and desktop/mobile layouts. Measured minimum contrast across tested text/icons is **5.97:1** for all three roles; unread-badge contrast separately exceeds 4.5:1. Mobile screenshots were visually inspected. This is targeted accessibility coverage, not a full screen-reader or WCAG certification.

Repository-wide `npm run lint` remains **FAIL** only on the unchanged `VerifiedPlantingCohortsPage.jsx`: two `react-hooks/set-state-in-effect` errors at lines 48/52 and one dependency warning at line 57. Its blob is unchanged from base 97087c9 (`0af80901a3f9722055ce3f457de5a8e34e619e09`). No suppression or unrelated refactoring was applied.

## Console and safety

No focused-hidden/React warnings remain in the executed acceptance scenarios. Injected inventory 503 and release 409 scenarios intentionally log their application errors; these are not extension warnings. Test diagnostics distinguish extension/content-script sources from application/browser sources. No extension-origin warning was observed in clean Chromium, and no MENRO code was changed to address browser-extension behavior. The user's extension-specific console output, if any, cannot be independently classified without its source URL/stack.

No production Firebase/API access, feature activation, dependency changes, backend source changes, pushes or deployment occurred. Local acceptance permits one scoped frontend commit on the existing `feature/phase3c-per-tree-monitoring` branch. The backend stays on `feature/phase3b-per-tree-evidence`, with no new backend commit needed. No branch is created, renamed or switched. Generated graphs and local screenshots/logs are excluded. Browser test services are owned by Playwright and released after execution; existing shared emulators, the original port-5173 dev server and unrelated processes are preserved.
