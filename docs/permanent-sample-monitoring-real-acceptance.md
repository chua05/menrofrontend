# Permanent Sample Monitoring - Real Local Acceptance

> Pre-commit reconciliation (2026-11-12): Historical secure-camera acceptance baseline (2026-11-11). Later implementation and regression results are recorded in permanent-sample-monitoring-completion-acceptance.md and permanent-sample-original-photo-completion-acceptance.md. The camera-only source discussion describes this stage; normal original uploads remain disabled. Historical results below are retained unchanged.

Date: 2026-11-11 (Asia/Manila). This follows `permanent-sample-monitoring-form-acceptance.md`; it does not replace the earlier implementation record.

## Decision

**Secure-camera LOCAL workflow: PASS. Full requested form acceptance: NOT COMPLETE.**

The final real-browser aggregate is 6/6 PASS. Staff draft/save, per-tree verified capture/private upload, submission, Admin Return, Staff correction/resubmission and Admin Approval work against real local Auth, Express, Firestore and Storage services. No production readiness or physical-device acceptance is implied.

Three requirements remain policy/contract limited:

1. **Original geotagged file upload is unsupported by the accepted permanent-sample evidence API.** It is disabled in the UI and a real valid-EXIF request was rejected separately for each Tree ID. This is a passing fail-closed security test, not passing original-upload functionality.
2. **Universal current-revision per-tree photo completeness is not an accepted backend rule.** The current visit service does not require a new photo for every assessment at submission/approval. MENRO must specify requirements for each condition and investigation outcome, especially Needs Rechecking and Not Located After Rechecking. No new requirement or exemption was invented.
3. **Automatic future visit creation remains disabled pending approved scheduling/selection policy.** Stored dates and policy-derived readiness are displayed; absent dates are not fabricated.

## Worktrees and preservation

- Frontend: `C:/tmp/menro-kyla-frontend`, branch `kyla`, HEAD `e198197a94d5b5a8c71cbfb0caf1cab76b31bfc7`.
- Backend: `C:/tmp/menro-kyla-backend`, branch `kyla`, HEAD `d7a5eac66ee4b730fb423454d8715643763d83d3`.
- Both branches/HEADs and staged entries remain unchanged; no commit, push, merge or deployment.
- Pre-existing uncommitted form implementation, Guest Attendance work, Leaflet lifecycle fix and other dirty work were preserved. In particular, GuestEventPage, guest-event.css, planting-guest-attendance.spec.js, seedPlantingViewReportBrowserAcceptance.js and the prior production backend service changes were not edited by this continuation.
- Dependency manifests/lockfiles match HEAD. No install or dependency changes.
- Generated media, private fixture data, logs and emulator files remain outside source in the uniquely owned temporary run directory. No ignored JPEG fixture generation/removal was performed.
- A graph query changed its cache timestamp; only this task's incidental timestamp was restored to its original clean contents. Other graph artifacts were preserved.

## Integration blocker and isolation

The old Firestore listener `127.0.0.1:8281` was PID 30892 (parent 36336, original creation time unchanged). Its ownership could not be established from a surviving launcher manifest. It was never queried, reused, stopped or reset.

The backend already accepted a second disposable test topology. This continuation used that exact contract in a fresh emulator process and a fresh temporary directory, with no dataset imports:

| Service | Endpoint/value |
| --- | --- |
| Demo project | `demo-menro-legacy-monitoring-20261106` |
| Auth | `127.0.0.1:9399` |
| Firestore | `127.0.0.1:8381` |
| Storage | `127.0.0.1:9398` |
| Bucket | `demo-menro-legacy-monitoring-20261106.firebasestorage.app` |
| Hub / logging / Firestore websocket | `127.0.0.1:4402` / `4502` / `9152` |
| Express / Vite | `127.0.0.1:5185` / `5186` |

All dedicated ports were free before each start. Listener addresses and owning CLI/Java process identities were recorded. Shutdown checked PID, creation time and the uniquely owned configuration/rules path before stopping leftover Java children. Only this run's processes were stopped. All dedicated ports were released; the unknown port-8281 listener retained its original PID/creation time.

The new frontend validator path requires an explicit monitoring-form acceptance flag, Vite DEV/test mode, emulator and browser-acceptance flags, the exact demo project/bucket/API and all three exact emulator hosts. Missing flags, production mode, credentials and mixed endpoints fail closed. Existing shared and isolated Phase 3C contracts remain unchanged. The real harness resolves both worktree paths from the pre-run manifest and checks them rather than using the stale backend path. Real App, AuthContext, authenticatedApi and SecureCameraCapture remain in use, with no Auth/API/component aliases.

Credential variables are rejected before Firebase bootstrap. The installed Firebase CLI uses process-local TEMP/cwd and no shared import/export. Its synthetic local FIREBASE_CONFIG is checked for the exact demo configuration and removed before strict application validation. Client rules deny direct data access; actual backend authorization is exercised.

Browser external requests are blocked. OSM tile requests are deliberately aborted, so the basemap may be gray; real Leaflet vectors, site coverage, registered-tree and evidence markers still render. Unknown external origins fail the suite. Backend proxies are closed to non-loopback traffic. No production Firebase, Render or Vercel resources were accessed.

## Confirmed defects fixed

1. **Native dialog blocked the real camera.** The monitoring form uses a native modal dialog; the real camera previously rendered outside it as a non-native dialog and became inert. The page now hosts the unchanged real capture component inside a native child modal. Actual click, Tab/Shift+Tab, Escape and focus restoration pass. The mock wrapper was aligned with the real page's ownership of the native dialog.
2. **Backend GPS code was lost at the page API boundary.** The API helper retained status/message but dropped the backend code used by SecureCameraCapture's location-error callback. Preserving that code now shows the real 422 rejection in the selected tree's Location Verification card. The other tree retains no leaked error/evidence state.
3. **Unwired location button.** SecureCameraCapture now displays View Detected Location only when an actual callback exists. Existing callers with a callback retain behavior; no GPS rule changed.
4. **Fixture/harness isolation.** Added the narrowly gated frontend test topology, current worktree path checks, scoped counter-reference ledger/cleanup and read-only private-object verification. Photo fixture generation is import-safe; no existing ignored JPEG is regenerated. Capture-session and evidence business validation were not modified in this continuation.

## Final executed results

| Check | PASS | FAIL |
| --- | ---: | ---: |
| Real browser aggregate, actual local services | 6 | 0 |
| Existing Phase 3C mocked browser suite | 27 | 0 |
| Monitoring form mocked browser suite | 19 | 0 |
| Frontend unit/safety tests | 53 | 0 |
| Backend unit/security/policy tests (17 suites) | 123 | 0 |
| Real per-tree evidence emulator regression | 7 | 0 |
| Real monitoring form emulator regression | 4 | 0 |

Scoped frontend ESLint: PASS. Repository-wide `npm run lint`: PASS (no baseline exception reproduced in this worktree). Normal `npm run build`: PASS, with the existing large-chunk advisory. Backend `node --check`: 17 affected monitoring source/test files PASS. `git diff --check`: both repositories PASS.

The frontend 53 include integration-environment 11, camera, Leaflet lifecycle, sample-form, location-preview, barangay map, monitoring-form and timeout/recovery checks. The backend 123 comprise visit 13, information 10, visit routes 1, discovery routes 4, evidence service 12, evidence routes 5, retrieval 2, capture runtime 4, queries 3, readiness 8, browser-harness guard 4, release 13, analytics 7, integration environment 9, capture session 10, coordinated policy 13 and monitoring schedule 5.

Earlier parallel cold-start runs timed out during Vite navigation before discovery (one real GPS prerequisite; 24/27 mocked tests passed in that run). They are not classified as passing runs. Final runs were serial with real navigation waiting for DOM readiness plus an exact collection-response waiter established before navigation. No arbitrary sleeps, unbounded timeout increases or backend validation bypasses were added. The final results above come from completed aggregate runs.

## Real-browser assertions and evidence

1. Staff and Admin use real Auth Emulator email/password login, backend session verification, discovery and authoritative two-tree detail. Module responses confirm production AuthContext/authenticatedApi imports.
2. Unauthenticated route access redirects to login; Participant route access redirects according to the real guard. Participant and non-owner Staff cannot access the fixture visit; non-owner discovery is empty.
3. A generated valid original EXIF JPEG at the fixture site is rejected by the real private evidence API for TREE-001 and TREE-002, with no version/history change. UI original-upload buttons are disabled.
4. Real MediaStream has a live video track and nonzero dimensions; canvas produces real JPEG bytes. Camera modal keyboard/focus behavior passes.
5. Actual outside-site capture verification returns 422 `CAPTURE_LOCATION_OUTSIDE_SITE`. The exact backend message reaches only TREE-001's location card; upload remains disabled and both histories remain unchanged.
6. Full two-tree lifecycle passes: one Healthy assessment and one Needs Rechecking assessment with required remarks; draft saves; separate camera captures/previews/locations; real multipart uploads; submit; Admin private retrieval and required-return-reason validation; Return; TREE-002 correction; new revision photo; resubmit; Admin retrieval of both revisions; Approve; Staff read-only UI and rejected write.

The test checks actual registered-tree (gold) and evidence (blue) Leaflet SVG markers. It switches trees and verifies separate pending previews and stored coordinates; uploading one does not remove the other pending photo. A cross-tree capture binding is rejected. No private bucket/object/intent fields appear in authorized visit detail or public Storage URL in the rendered images.

Read-only Firestore/Storage verification immediately before cleanup confirmed APPROVED, version 5, dateMonitored/visitDate 2026-11-11, no nextMonitoringDate, and:

| Tree | Revision | Fixture latitude | Accuracy | Private JPEG bytes | SHA-256 |
| --- | ---: | ---: | ---: | ---: | --- |
| TREE-001 | 0 | 12.662311 | 5 m | 59402 | Matches stored hash |
| TREE-002 | 0 | 12.662341 | 5 m | 59409 | Matches stored hash |
| TREE-002 | 1 | 12.662336 | 5 m | 59375 | Matches stored hash |

All use fixture longitude 123.932983. These are simulated fixture coordinates, not the user's location. Each object existed, matched its authoritative evidence reference and linked upload intent, and retained the expected owner. No private object names, capture tokens or raw photo bytes are included in this report.

Browser-verified security: wrong-tree binding rejection, stale version 409, Participant/non-owner/unauthenticated historical-evidence denial, Approved write rejection, protected Admin historical retrieval, immutable evidence revisions [0] and [0,1], and exact successful upload retry without duplicate evidence links (including after approval).

Backend emulator/unit coverage additionally verifies altered/replayed captures, changed idempotent operations, nonce/session ownership, binding/revision/version validation, SHA uniqueness, and new uploads after approval. GPS accuracy accepts at most 50 m and is checked independently of the authoritative site boundary (configured coverage radius/polygon or 50 m fallback). Being physically inside a site does not override inaccurate device location. These assertions do not establish resistance to every compromised client or real-device behavior.

## Evidence policy audit

- Baseline registration evidence and visit-assessment evidence are separate contracts.
- `sampleMonitoringVisit.service.js` requires an assessment for every authoritative sample, allowed conditions, remarks for Needs Rechecking and documented search findings for Not Located After Rechecking. The investigation outcome must belong to Needs Rechecking. It does not convert unresolved trees to Dead.
- The current save/submit and review normalization do not enforce one newly attached photo for every current assessment revision. A successful photo-bearing test does not prove a missing-photo rule exists.
- `sampleMonitoringEvidence.service.js` requires a verified Staff capture session when evidence is attached. `evidenceCaptureSession.service.js` does not provide that session for uploaded-original sources. Simply accepting editable EXIF or bypassing the session would weaken the contract and was not implemented.
- MENRO must decide whether each condition requires current-revision evidence, what evidence documents a not-located search, whether rechecking can be submitted before another field capture, and what secure original-file provenance is acceptable. Approval of those requirements must precede a completeness or original-source change.

## Schedule audit

`purposePolicy.service.js` retains a 10% default percentage and 12-month interval, with minimum sample size, first-visit delay and selection procedures pending unless supplied through an approved policy snapshot. `samplingReadiness` calculates a first due date only from an actual planting date and supplied policy delay; `automaticCreationEnabled` remains false. `sampleMonitoringVisit.service.js` rejects non-test visit creation pending MENRO policy approval.

The real lifecycle left the authorized visit date unchanged and did not create a next date. The UI uses supplied schedule fields or an awaiting-approved-schedule message. Unit/emulator checks cover actual monitoring-date validation, stored schedule preservation and policy-derived dates; fixture policy examples are not MENRO policy approval. Existing monitoringSchedule regression tests pass. No historical records, schedule dates or production scheduling policies were migrated or recalculated.

## Cleanup

Read-only initial Auth/Firestore/Storage checks were all zero. Browser fixtures were UUID-scoped. The final explicit cleanup removed 37 owned records, 4 fixture users and 3 referenced private objects. A second pass removed 0 records/users/objects and verified success. Post-run read-only counts were zero. The separately executed emulator regressions also left a clean environment.

Cleanup uses authoritative visit/cohort/site/actor references for evidence hashes, capture sessions, intents, operations and referenced objects. Scoped numbering counters are recorded in the fixture's own exact-reference ledger; generic shared counters are not swept. No global collection, bucket or Auth reset was used. Unknown/shared emulator data was not accessed.

## This continuation's exact repository files

Frontend modified:

- `src/pages/PermanentSampleMonitoringPage.jsx` - native camera host and preserved backend error code.
- `src/components/SecureCameraCapture.jsx` - hide an action without its callback.
- `src/styles/permanent-sample-monitoring-form.css` - scoped native camera-host presentation.
- `src/config/integrationEnvironment.js` - exact test-only topology and token audience.
- `tests/integrationEnvironment.test.mjs` - positive/negative topology/audience tests.
- `tests/phase3c/mocks/SecureCameraCapture.jsx` - mock follows actual page dialog ownership.

Frontend added:

- `vite.sample-monitoring-real.config.js` - real-module isolated Vite entry configuration.
- `playwright.sample-monitoring-real.config.js` - checked worktree paths, unique real media fixture, local servers.
- `tests/e2e/sample-monitoring-real.spec.js` - six real-service acceptance tests.
- `tests/monitoring-real/teardown.js` - read-only evidence audit and explicit cleanup twice.
- `docs/permanent-sample-monitoring-real-acceptance.md` - this report.

Backend modified (test infrastructure only):

- `tests/integration/phase3cBrowserServer.js` - guarded mode, two-tree UUID fixture, real current date, scoped counter ledger.
- `tests/integration/phase3cBrowserFixtureCleanup.js` - exact visit date and owned counter-reference cleanup.
- `tests/integration/phase3cBrowserCleanup.js` - same guarded alternative topology.
- `tests/integration/generateEvidenceFixtures.js` - import existing JPEG generator without regenerating fixture files.

Backend added:

- `tests/integration/sampleMonitoringBrowserAudit.js` - read-only private object/hash/linkage audit with sanitized failure output.
- `tests/sampleMonitoringBrowserHarness.test.js` - fail-before-bootstrap tests.

Prior uncommitted monitoring form/service/tests remain part of the combined tested working tree but were not overwritten; consult the previous acceptance report for their implementation file list.

## Commands and local artifacts

Real aggregate: `python <run-root>/run.py`, which runs the installed CLI's `emulators:exec` and then `node node_modules/@playwright/test/cli.js test --config playwright.sample-monitoring-real.config.js --reporter=list` with guarded process-local variables. Backend emulator regressions use the same fresh wrapper with `MENRO_SKIP_BROWSER=true` and `MENRO_RUN_EMULATOR_REGRESSIONS=true`, invoking the two real emulator test files separately. No dependency installation is involved.

Mock suites: `node node_modules/@playwright/test/cli.js test --config playwright.phase3c.config.js --workers 1 --reporter=list` and `node node_modules/@playwright/test/cli.js test --config playwright.sample-monitoring-form.config.js --reporter=list`.

Run root: `C:/Users/chuak/AppData/Local/Temp/menro-monitoring-acceptance-32hl4kkv`.

- `browser.log`, `emulator.log`: final real aggregate and owned startup/shutdown.
- `private-evidence-audit.log`, `explicit-cleanup.json`, `verified-listeners.json`: final persistence/cleanup/ownership evidence.
- `frontend-final-results.json`, `backend-unit-results.json`, `backend-syntax-results.json`, `emulator-regression-results.json`: exact check outcomes.
- `sampleMonitoringEvidenceFixtureEmulator.log`, `sampleMonitoringFormEmulator.log`: real backend emulator regression details.
- `browser-results/.../approved-visit.png`: approved read-only browser evidence; six-width monitoring form screenshots are in the ignored frontend Playwright results.

Nonblocking environment/tool warnings retained without suppression: exifr dynamic-import analysis, SDK/bridge PassThrough listener warnings, Storage rules-runtime shutdown NPE after exit 0, normal build chunk-size advisory, and missing optional MapTiler key on the unrelated dashboard in this isolated environment. No MapTiler credentials or network access were added. OSM basemap tiles are intentionally blocked. No application uncaught page errors occurred in the passing real aggregate.

Real Android/iOS camera selection/permissions, GPS acquisition/accuracy, physical site alignment, original device EXIF, interrupted/mobile-network upload and background/resume remain physical-device acceptance work. Production policy approvals, trusted-original-file support, approved sample selection/scheduling, rollout and production activation are outside this local acceptance.
