# Planting report and login corrections: local acceptance

Date: 2026-11-05 (Asia/Manila).

Result: local functional acceptance, with the explicitly documented repository lint exception below. This is not authorization to push, merge, deploy, activate production gates or change MENRO policy.

## Implemented behavior

- Participant keeps the existing planting details, original-photo/camera verification and map flow. The selected species adds nonnegative integer leftovers; planted plus leftovers cannot exceed the server-owned remaining release. Optional private attendance uses the shared one-file JPEG/PNG/PDF control (10 MB).
- Staff uses the separate Official Planting Report with authoritative requester, event, site, release and authenticated Staff information. Species headings are readable sections. MENRO Field Reports require actual server-verified private photos before Admin approval. Individual release-based confirmation remains explicitly not photo/GPS verification.
- Camera captures retain the real component, JPEG bytes, location acquisition and backend-issued session verification. Existing uploads retain original EXIF; the server enforces municipality, site, timestamp, hash, nonce and revision rules. Returning/correcting a submission preserves the original evidence.
- Saved report recovery uploads evidence without reposting quantities. Ambiguous photo uploads keep the same files and idempotency key. Attendance selection errors remain inline until corrected or explicitly omitted. Removing a selection never deletes a saved attachment.
- Participant and Staff forms use native modal containment; nested camera Escape closes only the camera and restores focus. Existing Release Seedlings modal and sidebar behavior remains intact.
- New interactive Email and Google handler paths use the verified role dashboard, preserving incomplete-Participant profile completion. Existing authenticated deep links and refresh behavior remain valid. The single login toast is fixed below the header, accessible, dismissible, approximately four seconds and cleared on logout.
- Private gallery and submission thumbnails coalesce concurrent reads only for the same authenticated user and endpoint, with two concurrent reads per browser context. Completed images are not cached. Unmounted components do not receive stale image URLs. Server authorization and retrieval integrity checks remain mandatory.

## Executed checks

These are separate completed suites, not an inferred single aggregate runner.

| Check | Result |
| --- | --- |
| Frontend unit/safety, 46 files | 201/201 PASS |
| Backend credential-free regressions, 78 files | 783/783 PASS |
| Workflow forms Playwright | 17/17 PASS |
| Added attendance drag/drop assertion, affected test rerun | 1/1 PASS |
| Email/Google login handler and route tests, all three roles | 6/6 PASS |
| Existing Release/sidebar/topbar accessibility | 12/12 PASS |
| Existing mocked permanent-sample workflows | 25/25 PASS |
| Real Staff report/photos/attendance/return/correction/approval and privacy | 2/2 PASS |
| Existing real permanent-sample browser workflows | 5/5 PASS |
| Existing real communication and analytics browser workflows | 3/3 PASS |
| Per-tree emulator lifecycle/evidence | 7/7 PASS |
| Evidence workflow emulator regression | 17/17 PASS |
| Scoped ESLint | PASS |
| Normal Vite production build | PASS; existing large-chunk warning |
| Backend changed-file syntax | PASS |
| Both worktree diff checks | PASS |
| Dependency manifests/lockfiles | Unchanged |

Unit runner reports are local-only under TEMP: frontend `menro-workflow-unit-frontend-7bbefeae-ac1c-4d62-a229-b521469c3724`; backend `menro-workflow-unit-backend-fabc0f5d-8251-4ab9-a3ad-29b64518bbf2`.

Browser commands use `playwright.workflow.config.js`, `playwright.login.config.js`, `playwright.ui-a11y.config.js`, `playwright.phase3c.config.js`, `playwright.workflow-real.config.js`, `playwright.phase3c-isolated.config.js` and `playwright.phase3d4-isolated.config.js`. Real tests use actual App/Auth/API/camera code with the isolated demo emulators. Login handler tests deliberately substitute Firebase boundaries; they do not prove a live Google provider handshake.

## Repository lint exception

`npm run lint` is **FAIL**, not PASS: unchanged `src/pages/VerifiedPlantingCohortsPage.jsx` has two `react-hooks/set-state-in-effect` errors at lines 48 and 52 and one `react-hooks/exhaustive-deps` warning at line 57. Its current and base `97087c9` Git blob IDs both equal `0af80901a3f9722055ce3f457de5a8e34e619e09`. No suppression or unrelated refactor was applied. Every changed source/test file passes scoped ESLint.

## Confirmed integration corrections

The locked Storage SDK can receive response headers after a consumer disconnect. Its retry stream emits `response` before wiring its delay stream; calling `abort()` too early clears that stream and can crash at `.pipe()`. Cancellation now stops the consumer immediately and defers SDK abort until the response callback unwinds, retaining the existing timeout, concurrency limit and all integrity checks. A regression uses the installed `retry-request` package to reproduce the exact late-response ordering; private retrieval tests pass 19/19.

The browser report displayed the same photo in the gallery and submission card. Concurrent reads are now coalesced and bounded; a deterministic real-component browser test proves those two views issue one authenticated request. Private original and corrected photos are independently retrieved through the actual local backend after approval.

Existing real-browser prerequisites were updated for the approved fresh-login dashboard rule: authentication is verified first, then the authorized operational page is opened with its response waiter armed. The incomplete-Participant profile gate remains active.

## Isolation, cleanup and source review

Only `demo-menro-phase3c-isolated` was used: Auth 127.0.0.1:9299, Firestore 127.0.0.1:8281, Storage 127.0.0.1:9298, Hub 127.0.0.1:4401, backend 5185 and frontend 5186. No shared emulator dataset was queried or reset, and no production credentials/endpoints were used. All browser network boundaries reject unapproved origins.

The new emulator run was clean before seeding. Cleanup verifies authoritative UUID fixture relationships for official operations, photo workflows, capture sessions, upload intents, hashes, quota artifacts and referenced objects. Explicit repeated cleanup returned zero records/users/objects removed and verified success. Final read-only checks found zero users, Storage objects or fixture records in the checked monitoring, cohort, site, contribution, operation, session, intent and hash collections. Only the launcher-owned process tree was stopped; all dedicated emulator/backend/frontend ports were released.

Both original feature branches are preserved. Generated `graphify-out` artifacts, browser output, media, logs, fixture records, secrets and unrelated files are excluded from local commits. AST-only graph refresh ran; its unrelated pre-existing Swift extraction warning does not affect JavaScript acceptance.

## Source files

Frontend source:

- `src/components/AttendanceUpload.jsx`
- `src/components/OfficialPlantingPhotos.jsx`
- `src/components/StaffPlantingReportForm.jsx`
- `src/components/ModalDialog.jsx`
- `src/components/ProtectedEvidenceImage.jsx`
- `src/context/AuthContext.jsx`
- `src/context/ToastContext.jsx`
- `src/layouts/Topbar.jsx`
- `src/pages/DashboardPage.jsx`
- `src/pages/LoginPage.jsx`
- `src/pages/PlantingPage.jsx`
- `src/routes/RootRedirect.jsx`
- `src/styles/attendance-upload.css`
- `src/styles/official-planting.css`
- `src/styles/toast.css`
- `src/utils/attendanceFile.js`
- `src/utils/loginSuccess.js`
- `src/utils/plantingReportForm.js`
- `src/utils/postLoginRoute.js`
- `src/utils/privateImageRequests.js`

Frontend tests/configuration: `tests/e2e/workflow-forms.spec.js`, `workflow-real.spec.js`, `login-corrections.spec.js`, `phase3c-real.spec.js`, `phase3d4-real.spec.js`, `permanent-sample-release.spec.js`; `tests/login/AuthContext.js`, `tests/login/authBoundary.js`; `tests/plantingLoginCorrections.test.js`, `tests/privateImageRequests.test.js`, `tests/messengerAuthFlow.test.js`, `tests/toastSystem.test.js`; `vite.login-test.config.js`, `playwright.login.config.js` and this acceptance record.

Backend source:

- `src/controller/officialPlantingReport.controller.js`
- `src/controller/plantingReport.controller.js`
- `src/routes/plantingReport.routes.js`
- `src/services/evidenceAccess.service.js`
- `src/services/firebaseEvidenceRetrieval.service.js`
- `src/services/officialPlantingEvidence.service.js`
- `src/services/officialPlantingReport.service.js`
- `src/services/parentPlantingReport.service.js`
- `src/services/plantingAttendance.service.js`
- `src/services/plantingReport.service.js`

Backend tests/docs: `tests/connectedWorkflow.test.js`, `tests/evidenceAccess.test.js`, `tests/evidenceUploadMaintenance.test.js`, `tests/firebaseEvidenceRetrieval.test.js`, `tests/officialPlantingReport.routes.test.js`, `tests/officialPlantingReport.test.js`, `tests/plantingAttendance.test.js`, `tests/integration/combinedWorkflowFixture.js`, `docs/combined-workflow-contract.md`.

## Remaining limits

Physical Android/iOS camera, GPS accuracy, original EXIF and device permission/offline acceptance remain separate. Mocked Google handler coverage is not live Google OAuth acceptance. Local runs report missing background-map credentials and SDK listener warnings; no credentials were added and warnings were not suppressed. MENRO production activation, retention/reconciliation, scheduling, sampling and official KPI/reporting decisions remain unapproved and unchanged. No push, merge, deployment or production feature activation occurred.
