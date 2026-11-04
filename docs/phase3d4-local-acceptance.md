# Phase 3D / Phase 4 frontend local acceptance — 2026-11-04

Baseline: `0f193c2c0a8bb484d24968e6ea68b8f9dc0fca31`. Backend baseline: `3651a095a174abe9cfe6e49f175708faa0288f10`.

Reviewed frontend files:

- `src/App.jsx`
- `src/layouts/Sidebar.jsx`
- `src/layouts/Topbar.jsx`
- `src/pages/PermanentSampleMonitoringPage.jsx`
- `src/pages/MonitoringInformationPage.jsx`
- `src/pages/PermanentSampleAnalyticsPage.jsx`
- `src/components/MonitoringInformationPanel.jsx`
- `src/services/permanentSampleApi.js`
- `src/utils/permanentSampleFeatures.js`
- `src/utils/notificationRoutes.js`
- `tests/e2e/phase3d4-real.spec.js`
- `tests/permanentSampleFeatures.test.js`
- `vite.phase3d4-isolated.config.js`
- `playwright.phase3d4-isolated.config.js`
- This acceptance record.

The existing visit detail now has a separately gated optional Request Information panel. The server derives the verified requester; clients cannot choose a recipient. The existing notification panel offers Answer This, opens the protected requester page/modal and records a versioned idempotent reply. Owner Staff and existing-scope Admin can read request/reply history. Private monitoring photos are not shared with requesters. Questions never block visit saves, submission, review or approval.

Separate Staff/Admin routes `/staff/permanent-sample-analytics` and `/admin/permanent-sample-analytics` show Permanent Sample Monitoring Analytics: approved baseline tree counts, assessed/unassessed/unresolved coverage, condition breakdown, site/cohort filters and chronological approved history/evidence revision indexes. Results use one latest approved observation per cohort/tree; unresolved/not-located observations are not deaths. No official whole-site estimate or KPI projection is displayed.

`VITE_MONITORING_INFORMATION_ENABLED=true` and `VITE_PERMANENT_SAMPLE_ANALYTICS_ENABLED=true` are independent gates that also require the existing cohort gate. Both default off and protect routes/navigation as well as the new visit panel. Backend gates are independently enforced. Only `vite.phase3d4-isolated.config.js` / `playwright.phase3d4-isolated.config.js` enable them for new acceptance; the accepted mocked/shared/Phase 3C configurations remain unchanged.

## Final results

| Check | Result |
| --- | --- |
| New real Auth/API browser workflows | 2/2 PASS |
| Existing Phase 3C real browser | 5/5 PASS |
| Existing mocked browser | 23/23 PASS |
| Frontend unit/safety/navigation tests | 63/63 PASS, including three new feature tests |
| Backend existing credential-free / new service checks | 135/135 and 15/15 PASS |
| Backend per-tree / workflow / cleanup-sentinel emulator suites | 7/7, 17/17 and 1/1 PASS |
| Scoped ESLint | PASS |
| Normal `npm run build` | PASS, existing chunk-size advisory |
| Backend syntax / both `git diff --check` | PASS |
| Repository-wide ESLint | FAIL: unchanged baseline, 2 errors and 1 warning |

New real browser coverage includes the actual notification Answer This action, real requester reply, stale-version rejection, exact question/reply retry, altered question conflict, non-owner and unauthenticated denial, Participant analytics denial, Staff/Admin reply visibility, unanswered-question approval, pending-visit exclusion and correct unresolved counts. Service tests cover wrong/changed requester identity, missing authoritative source, concurrent retries, disabled gates, partial counts, duplicate identities and historical transitions. These do not replace physical-device tests.

The lint exception is unchanged `VerifiedPlantingCohortsPage.jsx`: lines 48/52 state-in-effect errors and line 57 missing `selected` dependency warning. Its current and base `97087c9` blob is `0af80901a3f9722055ce3f457de5a8e34e619e09`. That file and its rules were not modified or suppressed.

All new integration used only the clean disposable `demo-menro-phase3c-isolated` topology (Auth9299/Firestore8281/Storage9298/Hub4401, exact isolated bucket, API5185/frontend5186). Real App/AuthProvider/authenticatedApi remain active; unexpected external browser origins fail tests. UUID cleanup ran twice, preserved independent Auth/Firestore/Storage sentinels, and left zero Auth users, nonempty Firestore collections or Storage objects. Only verified launcher descendants were stopped; all owned ports were released. Shared emulator data and unknown processes were untouched.

Local functional acceptance is GO with the existing lint exception. Production remains off. MENRO scheduling/sampling/official-KPI decisions, authoritative relationship verification for legacy cohorts, production Firestore privacy/index review, rollout approval and physical-device camera/GPS/EXIF testing remain separate. No manifests/dependencies, production configuration, legacy participant monitoring, official KPIs or scheduling changed. No push, merge or deployment occurred.
