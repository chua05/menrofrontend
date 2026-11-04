# Phase 3C local development acceptance — 2026-11-04

Functional local acceptance passes with the existing repository lint exception below. This is not production activation or physical-device acceptance.

## Executed final results

| Check | Result |
| --- | --- |
| Real browser aggregate, `playwright.phase3c-isolated.config.js` | 5/5 PASS, zero skipped/flaky tests |
| Mocked aggregate, `playwright.phase3c.config.js` | 23/23 PASS, zero skipped/flaky tests |
| Existing frontend auth, camera, evidence, monitoring, navigation and safety unit regressions | 54/54 PASS |
| Frontend shared/isolated environment validators (included in 54) | 9/9 PASS |
| Phase 3C scoped ESLint | PASS |
| `npm run lint` | FAIL: unchanged baseline, 2 errors and 1 warning |
| `npm run build` | PASS; existing large-chunk advisory remains |
| `git diff --check` and dependency-manifest comparison | PASS |

The real-browser suite runs the actual App, AuthProvider, authenticatedApi, SecureCameraCapture and local Express backend. It verifies Staff/Admin discovery/detail, unauthenticated/Participant/non-owner Staff denial, real Chromium media and fixture geolocation, capture verification, private upload/retrieval, and the full Staff submission → Admin return → Staff revision → resubmission → approval flow. Revisions 0 and 1 remain privately retrievable; approval removes editing controls. External browser origins cause a test failure. Auth/API/component mocks apply only to the separate mocked suite.

Backend acceptance: 124/124 credential-free regressions, 7/7 per-tree emulator checks and 17/17 evidence-workflow emulator checks. Stale writes, capture ownership/revision/GPS binding, SHA uniqueness, replay rejection and exact completed-upload idempotency are additionally covered by backend tests; the browser suite does not independently repeat every backend fault injection.

## Baseline lint exception

`src/pages/VerifiedPlantingCohortsPage.jsx` is identical to frontend base `97087c9`: both Git blobs are `0af80901a3f9722055ce3f457de5a8e34e619e09`.

- Line 48: `react-hooks/set-state-in-effect` error.
- Line 52: `react-hooks/set-state-in-effect` error.
- Line 57: `react-hooks/exhaustive-deps` warning for the missing `selected` dependency.

That page and its lint rules were not changed or suppressed. Repository-wide lint is not a passing check.

## Isolation and cleanup

The real browser used only `demo-menro-phase3c-isolated`, Auth `127.0.0.1:9299`, Firestore `127.0.0.1:8281`, Storage `127.0.0.1:9298`, Hub `127.0.0.1:4401`, bucket `demo-menro-phase3c-isolated.firebasestorage.app`, backend `127.0.0.1:5185` and frontend `127.0.0.1:5186`.

Cleanup verifies UUID ownership, exact object/intent bindings and removal rather than relying on Windows signal handlers. Two final cleanup calls removed zero resources. Final isolated counts were zero for Auth users, sites, cohorts, visits, captures, SHA reservations, upload intents, workflow operations, quota reservations/days/audit and Storage objects. Only verified launcher descendants were stopped; all owned ports were released. Existing shared emulator listener PIDs were unchanged.

Source review excludes credentials, generated logs/media/results, transient fixture data, dependency changes and unrelated participant/KPI/analytics/scheduling changes. Backend HTTP responses strip private evidence transport references and never accept client overrides of the authenticated actor or route visit ID.

## Remaining release requirements

Physical-device camera permissions, GPS accuracy, EXIF/device behavior and interrupted mobile networking require separate testing. MENRO scheduling/visit-creation policy, deployment compatibility and explicit production rollout approval remain prerequisites. There is no Create Visit UI or automatic scheduling, and no production access, feature activation, push or deployment occurred.
