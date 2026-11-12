# Permanent sample monitoring form: local implementation and acceptance

> Pre-commit reconciliation (2026-11-12): Historical implementation snapshot (2026-11-11). Its listener/path blocker was subsequently resolved in permanent-sample-monitoring-real-acceptance.md. Original-upload statements describe this earlier stage and normal operation. See permanent-sample-original-photo-completion-acceptance.md for the guarded local proposal and later regression closure. Historical results below are retained unchanged.

Date: 2026-11-11. No commit, push, merge, deployment, production access, dependency change or production gate activation.

## Scope and reference

The supplied video is a visual reference for form content. Example names/counts/map placeholders in it are not production data. The implementation reuses the existing permanent-sample visit page, protected Staff/Admin routes, native modal, secure camera, private evidence endpoints, requester-information service and Leaflet map. Historical aggregate monitoring remains separate and unchanged.

Existing worktrees/branches: frontend `C:/tmp/menro-kyla-frontend` / `kyla` at `e198197a94d5b5a8c71cbfb0caf1cab76b31bfc7`; backend `C:/tmp/menro-kyla-backend` / `kyla` at `d7a5eac66ee4b730fb423454d8715643763d83d3`. Both HEADs and indexes remain unchanged.

## Functional status

| Form section | Implemented behavior / limit |
|---|---|
| 1. Verified planting site | Authorized source report, site, verified quantity, approved sample count and species from a safe backend view context. Unknown metadata stays unknown. |
| 2. Dates and schedule | Read-only stored schedule/readiness dates; actual Date Monitored saved separately, Manila-local default and future-date rejection. No schedule date mutations. Official automatic future visit creation remains policy-blocked by the existing service. |
| 3. Progress | Immediate derived assessed, unresolved and unassessed counts. Damaged remains living; unresolved is not converted to Dead. |
| 4. Tree records | All IDs from authoritative visit assessments, one active assessment, Previous/Next navigation and retained unsaved edits. Existing baseline registration/approval remains the authoritative first-visit workflow. |
| 5. Individual assessment | Prior approved visit/baseline reference; height in cm (baseline metres converted), diameter cm, four accepted conditions, inline errors and focus. Separate pending photos/private history per tree; stable upload retry key and binding; registered site/tree/evidence Leaflet layers. Original-file EXIF upload is disabled because the permanent-sample backend accepts only verified browser-camera sessions. |
| 6. Rechecking/clarification | Required remarks/search findings; separate Not Located After Rechecking outcome. Optional question binds saved visit/tree/revision, deduplicates the same case, derives recipient from authoritative source, and uses existing Answer This/reply authorization. Unanswered requests do not block monitoring. Recheck queue is retained; no invented follow-up schedule. |
| 7. Summary | Derived condition totals and bounded optional visit remarks. No new official survival calculation. |
| Save / submit / review | Incomplete drafts, one final visit PUT, expectedVersion, inline validation, preserved returned revisions/history, Admin review and approved read-only. Bounded requests, explicit uncertain-save reconciliation, no automatic stale-version mutation/retry. |

## API contracts used

- `GET /verified-sample-monitoring/visits` and `GET /verified-sample-monitoring/visits/:visitId`: existing discovery/detail. Authorized detail gains safe `visitContext`; private Storage transport references remain excluded from HTTP evidence history.
- Existing `PUT /verified-sample-monitoring/visits/:visitId`: `{expectedVersion, assessments, submit, visitRemarks?, dateMonitored?}`. Drafts can retain null/unassessed conditions; final submission remains strict. Negative/nonfinite/malformed measurements are refused. Optional metadata is additive and preserved when omitted by older clients.
- Existing capture-session creation/verification and multipart per-tree evidence PUT. Only verified session latitude/longitude/accuracy are added to newly linked history. Nonce, actor, visit, sample, version, revision, image hash, replay, private storage and idempotency checks remain intact.
- Existing protected baseline and monitoring evidence retrieval routes. No public Storage URL generation.
- Existing `POST /sample-monitoring-information` optionally accepts `sampleId` and `assessmentRevision`; visit-only clients keep their old contract. Existing answer endpoint and recipient derivation/RBAC remain in use.
- Existing whole-visit Admin review endpoint and eligible status transitions are reused. No per-tree approval endpoint, visit creation UI or scheduling controls added.

## Executed checks

| Check | Result |
|---|---|
| Focused browser form suite | 19 PASS / 0 FAIL |
| Existing Phase 3C routing/discovery/assessment/evidence/review suite | 27 PASS / 0 FAIL |
| Frontend measurement/map/legacy monitoring/request-timeout/topology tests | 45 PASS / 0 FAIL |
| Backend visit, requester information, routes, evidence, runtime, queries, readiness, release, analytics and topology regressions | 91 PASS / 0 FAIL (13 suites; affected visit suite rerun with 13 passing tests) |
| Real emulator evidence lifecycle | 7 PASS / 0 FAIL |
| New real emulator form/clarification/RBAC suite | 4 PASS / 0 FAIL |
| Scoped and repository-wide frontend ESLint | PASS, no suppressed rules |
| Vite production build | PASS; existing large-chunk warning remains |
| Backend node --check (11 task JS files) | PASS |
| git diff --check, both worktrees | PASS |

The 46 browser checks use explicit test-only Auth/API/camera boundaries. They are not proof of a new full real-browser-to-backend run or physical camera acceptance. The mock camera generates a decodable canvas JPEG; preview decoding is asserted. The 11 emulator cases use real Auth/Express/Firestore/Storage services with deterministic test evidence. Backend replay/RBAC/concurrency and actual private persistence/retrieval are exercised there.

Browser assertions cover context, all IDs, prior data, preserved tree edits, partial draft/reopen, date validation, conditions and first-error focus, tree question binding, private retry/history, HTTP 400/401/403/409/422/500/503, timeout/reconciliation (including modal close/reopen), role/gate denial, read-only approval, and 320/360/390/430/768/1440px overflow checks.

## Reproducible frontend commands

```powershell
node node_modules/@playwright/test/cli.js test --config playwright.sample-monitoring-form.config.js --reporter=list
node node_modules/@playwright/test/cli.js test --config playwright.phase3c.config.js --workers 1 --reporter=list
node --test --test-isolation=none tests/sampleMonitoringForm.test.js tests/plantingLocationPreview.test.js tests/barangayMap.test.mjs tests/monitoringForm.test.mjs tests/plantingRequestTimeout.test.js tests/integrationEnvironment.test.mjs
npm run lint
npm run build
git diff --check
```

## Real emulator isolation / cleanup

Used the already supported alternative isolated backend topology `demo-menro-legacy-monitoring-20261106`: Auth 127.0.0.1:9399, Firestore 127.0.0.1:8381, Storage 127.0.0.1:9398, Hub 4402, Logging 4502, websocket 9152. Ports were free before launch. CLI configuration, deny-all client rules, working directory, upload root and data stayed beneath the task temporary root; no shared export was imported. Backend privileged SDK access and actual API authorization were tested. All initial Auth/Firestore/Storage counts were empty.

Application preflight rejected credential/mixed-mode runner attempts before fixture access. Firebase CLI synthetic demo configuration was explicitly checked then removed before strict app validation; no production credential was loaded. Test subprocesses ran from the clean temporary directory so dotenv did not read the project environment file. Remote proxy targets were a closed local port; browser remote requests were intercepted and aborted.

UUID fixture cleanup passed, including a second no-op cleanup in the new suite. A final read verified no fixture documents/users/objects remained. Firebase CLI stopped its own Auth/Storage/Hub processes. Windows Java Firestore children left after CLI shutdown were stopped only after matching this run's exact command, dedicated ports, rules path, creation time and recorded parent. The CLI emitted a Storage rules-runtime NullPointerException during shutdown after successful tests/cleanup (CLI exit 0); the remaining task-owned Java process was explicitly released. All task emulator ports are released. The pre-existing unowned 8281/PID 30892 listener was never queried, reused or stopped. Shared emulator datasets were untouched.

## Visual evidence

Local artifact root: `C:\Users\chuak\AppData\Local\Temp\menro-sample-monitoring-form-b5u2i_2i`.

- `browser-results/permanent-sample-form-form-and-interactive-map-fit-<width>px/monitoring-form-top-<width>.png`
- `browser-results/permanent-sample-form-form-and-interactive-map-fit-<width>px/monitoring-form-<width>.png`

320px and 1440px screenshots were visually inspected. Sticky header/footer and a single scrolling body fit without document horizontal overflow. Real Leaflet controls/coverage/tree markers render. Remote OSM tiles are intentionally blocked in these tests, so the gray basemap in screenshots is not proof of live basemap availability; online tiles and physical-site acceptance remain separate checks.

## Remaining blockers / limitations

1. Full new-form real-browser-to-real-backend acceptance is NOT claimed. The frontend's approved real harness requires the occupied dedicated Phase 3C Firestore 8281 endpoint. Ownership was not proven, so its dataset was not reused. No frontend safety validator was broadened just to bypass this blocker. The existing `playwright.phase3c-real.config.js` and `playwright.phase3c-isolated.config.js` also reference `C:/Users/chuak/Desktop/menrobackend-phase3b-per-tree-evidence`, not the current `C:/tmp/menro-kyla-backend`; a reviewed current-worktree override is needed before claiming a new integrated browser run. The alternate isolated topology above proves backend integration separately.
2. Original uploaded-photo EXIF evidence is not an accepted permanent-sample backend source. The disabled Upload Existing Photo control explains this. Enabling it requires a separately specified secure backend contract; GPS/session/hash checks were not bypassed.
3. The existing visit service permits complete assessed submissions without universal per-tree photo completeness enforcement. Verification is strict for attached evidence. A mandatory-evidence/condition policy and corresponding server completion contract must be specified before claiming every submission requires a current-revision photo; no invented universal rule or exemption was added.
4. Official future permanent-sample visit creation/intervals and follow-up scheduling remain disabled pending MENRO policy. Stored readiness dates are displayed without importing historical aggregate cadence or manufacturing dates.
5. Physical Android/iOS camera/GPS/EXIF accuracy, permission/offline behavior, live OSM tiles and field-location acceptance require device testing. Deterministic browser/emulator evidence is not physical proof.

Recommendation: implemented supported local form changes have passing scoped checks; NO-GO for full requested end-to-end/production acceptance until the above integration and policy/contract gaps are closed. No automatic rollout or commit is authorized.

## Exact task files

Frontend:

- `src/pages/PermanentSampleMonitoringPage.jsx`
- `src/components/PermanentSampleVisitForm.jsx`
- `src/components/PlantingLocationMap.jsx`
- `src/components/MonitoringInformationPanel.jsx`
- `src/pages/MonitoringInformationPage.jsx`
- `src/pages/MonitoringPage.jsx`
- `src/styles/permanent-sample-monitoring-form.css`
- `src/utils/sampleMonitoringForm.js`
- `tests/e2e/permanent-sample-form.spec.js`
- `tests/e2e/phase3c-routing.spec.js`
- `tests/phase3c/mocks/SecureCameraCapture.jsx`
- `tests/phase3c/mocks/authenticatedApi.js`
- `tests/sampleMonitoringForm.test.js`
- `vite.sample-monitoring-form-test.config.js`
- `playwright.sample-monitoring-form.config.js`
- `docs/permanent-sample-monitoring-form-acceptance.md` (this report)

Backend:

- `src/controller/sampleMonitoringVisit.controller.js`
- `src/routes/sampleMonitoringInformation.routes.js`
- `src/services/sampleMonitoringEvidence.service.js`
- `src/services/sampleMonitoringInformation.service.js`
- `src/services/sampleMonitoringValidation.js`
- `src/services/sampleMonitoringVisit.service.js`
- `src/services/sampleMonitoringViewContext.js`
- `tests/sampleMonitoringInformation.test.js`
- `tests/sampleMonitoringReadiness.test.js`
- `tests/sampleMonitoringVisit.test.js`
- `tests/integration/sampleMonitoringFormEmulator.test.js`

## Preserved existing work

Original unrelated dirty files remain byte-identical: frontend GuestEventPage.jsx, guest-event.css and planting-guest-attendance.spec.js; backend seedPlantingViewReportBrowserAcceptance.js, guestAttendanceRateLimit.test.js and officialEvidenceCarryForwardEmulator.test.js. The pre-existing Leaflet animation cleanup remains intact inside the directly extended shared map. No files were staged; both indexes and HEADs match the initial task snapshot. Generated graphs and unrelated worktrees were not changed.

Test-only temporary runner/config files (outside either repository) remain under the local artifact root: `firebase.backend-form.json`, `deny.firestore.rules`, `deny.storage.rules`, `start-emulator-checks.py`, `run-emulator-checks.cjs`, `frontend-final-verification.py`, local result JSON/logs and screenshots. They contain only disposable demo configuration/fixture evidence and are not staged or committed.
