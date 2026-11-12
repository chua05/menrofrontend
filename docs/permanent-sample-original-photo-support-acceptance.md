# Permanent sample monitoring: original-photo support acceptance

> Pre-commit reconciliation (2026-11-12): Historical rejection-only original-photo stage. The 409 results below document the then-current camera-only contract, not the later proposed-original acceptance outcome. See permanent-sample-original-photo-completion-acceptance.md. Historical results below are retained unchanged.

Date: 2026-11-12 (Asia/Manila). This follows the completion and real-browser acceptance reports; it does not replace their baseline.

## Decision

**Safe supporting changes: locally PASS. Upload Existing Photo enablement: BLOCKED.**

The attachment explicitly requires keeping the action disabled if original-photo policy remains unresolved. Inspection of the current services, policy configuration and acceptance documents found no approved permanent-sample original-source admissibility, provenance or age rules. Existing planting-event/official planting-report rules were inspected and were not treated as monitoring authorization.

## Root cause

The existing permanent-sample upload service requires a verified Staff browser-camera session. The shared capture resolver returns no camera session for uploaded-original, an unregistered source, or an omitted manifest (which defaults to original). The service therefore rejects those uploads with HTTP 409. This is an intentional contract restriction, not an EXIF parser defect. Browser-camera timestamps, actor/site/tree/visit/version/revision, nonce/hash and replay checks cannot establish provenance for an older uploaded file.

## Exact implementation

- Kept Upload Existing Photo disabled. Added a visible explanation that original-photo verification rules await MENRO approval, with a Tree-ID-specific aria-describedby relationship. Take Photo remains enabled for authorized editable visits. Existing card styling and map/camera controls are reused.
- Preserved the same null-session rejection predicate and HTTP 409, adding stable code MONITORING_CAPTURE_REQUIRED and a useful Take Photo/policy explanation. Authorization, cohort/baseline/plan checks and private upload ordering are unchanged. No accepting source branch, endpoint or original-file validation policy was introduced.
- Added a service test showing rejected originals do not upload bytes, reserve an evidence hash, append history or consume the camera session; a subsequent legitimate camera operation still works.
- Added actual resolver tests showing original, unknown and omitted sources never become camera evidence. The four existing zero-version/revision tests remain intact.
- Added a per-tree UI test for disabled action, visible/accessible explanation and unchanged Take Photo availability. Expanded the real original-source test to exercise explicit uploaded-original and omitted manifests separately for both authoritative Tree IDs, asserting status/code, no private transport leak and unchanged version/history.

The production evidenceCaptureSession service, GPS validation, page upload state, Leaflet implementation, schedules, mandatory-photo rules, storage/access services, dependencies and configurations were not changed by this task.

## Final executed results

All final suites completed after the scoped source changes. Initial tests reproduced the absent error code and absent aria-describedby; those expected failures were corrected and are not counted as final passes.

| Check | PASS | FAIL |
| --- | ---: | ---: |
| Real React/Auth/API/backend/emulator browser aggregate | 6 | 0 |
| Existing mocked Phase 3C browser suite | 27 | 0 |
| Monitoring form browser suite | 24 | 0 |
| Frontend unit/source/safety regressions | 53 | 0 |
| Backend offline regressions, 27 suites | 227 | 0 |
| Real per-tree evidence emulator suite | 7 | 0 |
| Real form/clarification emulator suite | 4 | 0 |
| Backend node --check | 3 changed files PASS | 0 |
| Scoped and repository-wide frontend ESLint | PASS | 0 |
| Normal Vite production build | PASS | 0 |
| git diff --check, both worktrees | PASS | 0 |

The form suite includes responsive checks at 320, 360, 390, 430, 768 and 1440 px, retained tree edits/photos, draft/submission errors, safe retry and timeout reconciliation. The real suite retains actual AuthProvider/authenticatedApi/SecureCameraCapture, real camera MediaStream/canvas JPEGs, separate tree maps/markers, Staff submit, Admin Return, correction/resubmission and Approval. It verifies private historical retrieval, revisions [0] and [0,1], stale/cross-tree rejection, RBAC, approved read-only and stable-key idempotent retry.

### Original-photo acceptance matrix

| Case | Actual result / limitation |
| --- | --- |
| Valid synthetic original EXIF JPEG at the authorized site, explicit uploaded-original source | Real API 409 MONITORING_CAPTURE_REQUIRED for each Tree ID; no evidence linkage. PASS as rejection, not successful original-photo acceptance. |
| Same original with omitted manifest | Same real 409 for each Tree ID; it cannot acquire a camera source by omission. |
| Unknown source | Actual resolver returns null; it cannot become verified camera evidence. |
| Missing/unreadable EXIF GPS, absent/invalid timestamp, missing/unreliable accuracy, original-photo age, original outside-site/duplicate rules | No accepting monitoring-original contract exists, so source-specific acceptance/validation is BLOCKED, not claimed PASS. All such originals remain unsupported; no device GPS substitution or zero accuracy fallback was added. |
| Camera GPS/site/time, duplicate/replay, binding, stale revision, ownership, retry/concurrency | Existing camera/backend regression checks PASS; these do not prove a new original-file validator. |
| Physical Android/iOS originals and camera/GPS behavior | NOT EXECUTED. Existing physical-device checklist remains applicable. |

## Policy decisions still required

1. Which original-photo sources are admissible, what provenance assurance is sufficient, and how editable EXIF limitations must be represented. EXIF alone is not proof of authenticity or protection against all edits/spoofing.
2. Acceptable photo age, capture-date relationship to the actual monitoring visit, timezone/clock treatment and historical-photo eligibility.
3. Required GPS/timestamp/accuracy metadata and treatment of absent or unreliable accuracy, without turning missing accuracy into zero or replacing original GPS with device GPS. The existing 50 m camera limit remains unchanged.
4. Supported original formats/transformations and how an original is bound to the authorized Tree ID and assessment revision, including correction/carry-forward rules.

After approval, a distinct server-side original-photo contract can reuse byte decoding, private storage, SHA-256, ownership, duplicate/idempotency and authorized retrieval infrastructure. It must retain uploaded-original identity, verify original bytes/metadata server-side, and expose only safe per-tree verification/source/location fields. The button must stay disabled until that complete path has passed isolated acceptance. No policy is supplied by this report.

## Isolation, evidence integrity and cleanup

Fresh task-owned temporary root, no imports: C:/Users/chuak/AppData/Local/Temp/menro-original-photo-support-ks9o62tl.

Used the existing approved disposable demo topology: demo-menro-legacy-monitoring-20261106; Auth 9399, Firestore 8381, Storage 9398, Hub 4402, logging 4502, websocket 9152, all bound to 127.0.0.1. Backend 5185 and frontend 5186; mocked browser tests used 5184 separately. Required ports were free before startup. No persistent environment/configuration changes were made.

Empty Auth/Firestore/Storage were checked before seeding. Credential guards, deny-all client rules, UUID ownership checks and blocked external browser origins remained active. Remote OSM tiles were intentionally aborted; passing Leaflet vector/marker tests are not proof of online tile availability or physical location accuracy.

The private audit read three camera JPEG objects, checked their byte hashes and distinct linked locations, and confirmed Approved status with immutable TREE-002 revisions [0,1]. Original files were not stored as evidence. Rejected requests may leave ordinary failed-operation ledger entries; those are not evidence acceptance and were included in scoped cleanup.

Explicit cleanup removed 42 owned records, 4 users and 3 objects. The second run removed 0/0/0. Final and post-emulator-regression Auth/Firestore/Storage checks were empty. All harness-owned ports were released. The pre-existing 8281/PID 30892 listener and shared data were not contacted or changed.

Non-failing existing tooling advisories remain: large build chunk, exifr import analysis, optional dashboard MapTiler key, SDK PassThrough listener warnings and a Firebase rules-runtime shutdown NullPointerException after passing checks/cleanup and exit 0. They were not suppressed or refactored. The temporary approval-service interruption during log inspection was recovered; the running acceptance process completed normally and its final results were retrieved.

## Exact repository files changed by this task

Frontend:

- src/components/PermanentSampleVisitForm.jsx
- tests/e2e/permanent-sample-form.spec.js
- tests/e2e/sample-monitoring-real.spec.js
- docs/permanent-sample-original-photo-support-acceptance.md (new)

Backend:

- src/services/sampleMonitoringEvidence.service.js
- tests/sampleMonitoringEvidence.service.test.js
- tests/sampleMonitoringCaptureBinding.test.js

All other pre-existing modified/untracked files were compared against the pre-task hash snapshot and preserved. All 46 pre-existing ignored JPEG files were preserved byte-for-byte. Branches remain kyla; frontend HEAD e198197a94d5b5a8c71cbfb0caf1cab76b31bfc7 and backend HEAD d7a5eac66ee4b730fb423454d8715643763d83d3 remain unchanged. No files were staged or committed; no push, merge, deployment, production access or gate activation occurred.

## Local artifacts

The task root contains final-checks.json (exact commands/statuses), backend-unit-final-results.json, browser.log, emulator.log, emulator-regression-results.json, private-evidence-audit.log, explicit-cleanup.json, responsive browser artifacts and preservation-audit.json. Temporary test configs/media/data remain outside both repositories.

Recommendation: GO for the safe explanatory/error-code/rejection-test changes and preserved local camera workflow. NO-GO for claiming Upload Existing Photo is enabled or production-accepted until MENRO policy and the separate secure backend contract are approved and verified.
