# Permanent sample original-photo proposal: local validation acceptance

> Pre-commit reconciliation (2026-11-12): Historical strict-accuracy diagnostics proposal, superseded for local evaluation by permanent-sample-original-photo-completion-acceptance.md. The later proposal records accuracy as UNKNOWN and requires explicit Admin review; neither proposal constitutes formal MENRO approval. Diagnostics-only and rejection descriptions below belong to this earlier implementation; its historical results are retained unchanged.

Date: 2026-11-12 (Asia/Manila). Status: PROPOSED / PENDING FORMAL MENRO APPROVAL.

## Decision and limits

The separate backend original-photo **validation/preflight contract** is implemented and locally tested. An accepting original-photo upload/linking contract is NOT implemented or accepted: current infrastructure cannot independently establish trustworthy photo-origin GPS accuracy. No positive original-file fixture was manufactured or claimed trustworthy. Upload Existing Photo remains disabled in ordinary operation and in the proposed local UI, because enabling a picker that cannot complete would create an unsupported action.

This report extends, without modifying, permanent-sample-monitoring-completion-acceptance.md, permanent-sample-monitoring-real-acceptance.md and permanent-sample-original-photo-support-acceptance.md. Existing secure-camera/draft/submit/return/correction/resubmit/approval remains locally accepted; no production or physical-device acceptance is implied.

## Implemented proposed-only contract

`POST /api/verified-sample-monitoring/visits/:visitId/samples/:sampleId/original-photo/verify`

Multipart fields: source=uploaded-original, expectedVisitVersion, assessmentRevision, and exactly one photos file. Other client metadata, coordinates, accuracy, timestamp or binding claims cannot override server/embedded data. The endpoint is a read-only preflight: it never issues a camera/verification token, creates an upload intent, reserves a hash, stores an original object or appends authoritative evidence.

- Existing token verification, Staff-only RBAC, pilot/write-pause guards and cohort gate remain active. Only the owner of an editable DRAFT/RETURNED visit may reach file validation. Admin, Participant, nonowner and unauthenticated access are denied.
- Server lookup binds actor, cohort/site, authoritative permanent Tree ID, approved plan/baseline versions, visit version and assessment revision. A saved valid Date Monitored is required; it is not replaced by the scheduled date, upload time or device clock.
- Actual bytes use existing bounded image validation. The prototype supports original JPEG EXIF diagnostics only. Extensions/client MIME do not establish format; PNG/HEIC/converted files are not assumed to preserve the required metadata.
- Raw EXIF is parsed with reviveValues:false to avoid host-timezone Date conversion. Only DateTimeOriginal is used; digitized, creation, modification and file last-modified dates are not substitutes. OffsetTimeOriginal must be explicit and valid. Ambiguous timezone-naive timestamps are rejected rather than silently assumed Manila-local. Calendar validity, future time and the saved actual monitoring date in Asia/Manila are checked explicitly.
- Embedded GPS is required. Client/device coordinates cannot fill gaps. GPS DOP is not treated as meters, and missing accuracy is not zero. Finite reported GPSHPositioningError above 50 m is rejected. Existing exact camera location validation is reused for municipality, configured radius/polygon and 50 m fallback; its implementation and thresholds are unchanged.
- A plausible EXIF accuracy claim, including zero, is still rejected as ORIGINAL_ACCURACY_UNVERIFIABLE. Editable metadata alone is not independent origin/accuracy proof. Detectable screenshot metadata is rejected, without claiming all edits/spoofing are detectable.
- Server SHA-256 is checked against existing sample, baseline, planting and monitoring hash ledgers. No new reservation is written. Duplicate, stale, wrong-tree, source-spoofed and unauthorized requests fail closed.
- Historical evidence ID/index/reuse requests return ORIGINAL_REUSE_UNSUPPORTED. The material/nonmaterial correction boundary is unresolved; no original evidence is silently relinked. Existing camera history preservation and correction semantics were not changed.

All responses from the proposal controller identify policyStatus=PROPOSED_PENDING_MENRO_APPROVAL and linkingEnabled=false. An accidental future fall-through still produces an error rather than success. The ordinary camera evidence PUT endpoint continues rejecting uploaded originals with its existing MONITORING_CAPTURE_REQUIRED code.

### Local mode selection and safety

The new flag MENRO_MONITORING_ORIGINAL_PHOTO_PROPOSAL=true enables diagnostics only. It requires NODE_ENV=test, MENRO_INTEGRATION_TEST=true, MENRO_SAMPLE_MONITORING_FORM_ACCEPTANCE=true and the complete existing legacyMonitoringIsolated demo topology below. Production mode, missing/invalid flags, credentials/tokens, wrong/shared projects, mixed endpoints and wrong buckets fail closed. Missing or false proposal flag returns 404 before multipart processing. No global evidence policy, ordinary Firebase bootstrap, frontend environment contract or deployment setting was changed.

Project demo-menro-legacy-monitoring-20261106; Auth 127.0.0.1:9399; Firestore 127.0.0.1:8381; Storage 127.0.0.1:9398; bucket demo-menro-legacy-monitoring-20261106.firebasestorage.app. Hub/logging/websocket 4402/4502/9152. Real Express/Vite use 127.0.0.1:5185/5186; mocked tests use 5184 separately. These values are confined to test subprocesses and a fresh task temporary directory, not persistent production environment changes.

## Final completed results

| Check | PASS | FAIL |
| --- | ---: | ---: |
| Final actual React/Auth/API/backend/emulator browser aggregate | 6 | 0 |
| Existing Phase 3C mocked browser suite | 27 | 0 |
| Monitoring form browser suite, including all six responsive widths | 24 | 0 |
| Frontend unit/source/safety regressions | 53 | 0 |
| Backend offline regressions, 28 separate-process suites | 264 | 0 |
| Proposed-policy unit/config/raw-byte tests (included in 264) | 37 | 0 |
| Real existing per-tree evidence emulator suite | 7 | 0 |
| Real existing form/clarification emulator suite | 4 | 0 |
| Real proposed-original validation emulator suite | 7 | 0 |
| Backend syntax | 9 task JS files PASS | 0 |
| Scoped and repository-wide frontend lint | PASS | 0 |
| Normal Vite production build | PASS | 0 |
| Both worktrees git diff --check | PASS | 0 |

An initial combined --test-isolation=none command mixed module-cache mocks across existing route test files and produced one harness failure. Both route suites passed individually; the final coordinator ran every backend suite in its own process. No application logic or test expectation was weakened to address that invocation issue. A focused proposal emulator run also passed 7/7 before the complete final run; it is not added to the final counts.

### What the original-photo results establish

Actual synthetic JPEG bytes exercise missing GPS, missing DateTimeOriginal (including a digitized-date fallback attempt), invalid/missing timezone, wrong Manila monitoring date, future time, missing accuracy, DOP-only accuracy, over-50 m accuracy, outside-site location, unsupported format and detectable screenshot metadata. Plausible synthetic accuracy claims are rejection fixtures only. Unit tests check UTC-to-Manila day boundaries, zero version/revision binding, the cohort gate, missing actual dates and inactive sites. Real API tests check Staff ownership/RBAC, unknown trees, stale versions/revisions, explicit source identity, client metadata override rejection, duplicates, repeated/concurrent requests, Returned behavior, blocked reuse and Approved read-only state.

These are successful **rejection/preflight** checks, not positive original-photo acceptance. Original picker/preview upload, verified original GPS markers, durable original-upload idempotency, successful private original storage/retrieval and allowed nonmaterial original reuse remain blocked. Read-only repeated preflight requests do not prove durable upload idempotency. No fabricated GPS accuracy, capture token or evidence manifest was used to obtain a positive original result.

### Secure-camera regression evidence

The real browser aggregate still uses actual App/AuthProvider/authenticatedApi/SecureCameraCapture with real Auth/Express/Firestore/Storage emulators. It verifies two authoritative Tree IDs, real browser MediaStream/canvas JPEGs, separate previews/maps/registered-tree and evidence markers, field-specific GPS rejection, Staff draft/submit, authorized requester notification/reply, Admin Return, correction/new evidence, resubmission and Approval. Private authenticated retrieval decodes both corrected-tree revisions. Cross-tree binding, stale writes, unauthorized historical retrieval and exact stable-key retries remain covered. Approved visits remain read-only and no public Storage URL is rendered.

A separate privileged local audit checked three stored camera JPEG byte hashes and recorded TREE-001 history [0] and TREE-002 history [0,1]. No proposed original evidence was stored. Actual visit dates and existing schedules were preserved; no next date was generated.

## Remaining blockers

1. Formal MENRO approval of the user-selected same-day/strict original-source proposals, including acceptable provenance and how metadata limitations must be communicated.
2. A reviewed mechanism that can independently establish photo-origin accuracy, plus genuine independently verifiable sample evidence. The current shared extractor does not return accuracy; the proposal raw parser reads a self-reported EXIF tag but cannot authenticate it. Merely adding a numeric tag, using device GPS, setting a test flag or removing the final rejection is not an acceptable fix.
3. Explicit material/nonmaterial correction and evidence-reuse rules. This proposal rejects reuse instead of inventing exemptions; camera history and current mandatory-photo rules remain unchanged.
4. A policy decision or trusted time context if timezone-naive originals must be supported. This strict prototype does not infer a timezone for them.
5. Physical Android Chrome/iOS Safari checks for actual gallery files, JPEG/HEIC transformations, EXIF retention, permission/GPS accuracy, clock behavior, field boundaries and interrupted/background upload. Existing device checklist remains NOT EXECUTED. Local Chromium fake media/GPS and synthetic EXIF do not establish physical authenticity or GPS spoof resistance.

Only after the trust/policy gaps are resolved should an accepting distinct uploaded-original verification/linking contract be connected to the established private upload saga, authorization, integrity, duplicate, idempotency and retrieval services. It must retain original source/timestamp identifiers, require current binding and approved correction rules, and pass genuine positive plus negative emulator/device acceptance before enabling the picker. No change to automatic monitoring scheduling or universal photo mandates belongs to this task.

## Cleanup and preservation

Task artifacts: C:/Users/chuak/AppData/Local/Temp/menro-original-proposal-ns0zx172. The installed CLI used a new working/data directory, deny-all client rules and no shared import. Empty Auth/Firestore/Storage were verified before seeding. UUID cleanup after the real browser run removed 42 owned records, 4 users and 3 objects; the second cleanup removed 0/0/0. Each regression cleaned its own fixture, and final post-regression Auth/Firestore/Storage were empty. Only recorded run-owned processes were shut down; all dedicated ports were released. Unknown 8281/PID 30892 retained its parent/creation identity and was not contacted or reused. Shared data was not queried or modified.

Existing non-failing advisories remain: large build chunk, exifr import analysis, optional dashboard map key, SDK PassThrough listener warnings and Firebase rules-runtime shutdown NullPointerException after successful tests/cleanup and exit 0. They were not suppressed or refactored.

All unrelated pre-existing modified/untracked files, graphs, staged entries, manifests and 46 ignored JPEGs were preserved against the before-task snapshot. Both branches remain kyla, frontend HEAD e198197a94d5b5a8c71cbfb0caf1cab76b31bfc7 and backend HEAD d7a5eac66ee4b730fb423454d8715643763d83d3 unchanged. No commit, push, merge, deployment, production access, dependency change or production feature activation occurred.

## Exact task files

Frontend:

- src/components/PermanentSampleVisitForm.jsx (explanation only; action remains disabled)
- tests/e2e/permanent-sample-form.spec.js
- tests/e2e/sample-monitoring-real.spec.js
- docs/permanent-sample-original-photo-proposal-acceptance.md (new)

Backend:

- src/config/sampleMonitoringOriginalProposal.js (new)
- src/controller/sampleMonitoringOriginalPhoto.controller.js (new)
- src/routes/sampleMonitoringOriginalPhoto.routes.js (new)
- src/routes/sampleMonitoringVisit.routes.js (mount only)
- src/services/sampleMonitoringOriginalPhoto.service.js (new)
- src/services/evidenceCaptureSession.service.js (additive export of the unchanged validateLocation helper only)
- tests/helpers/sampleMonitoringOriginalPhotoFixtures.js (new, synthetic rejection fixtures only)
- tests/sampleMonitoringOriginalProposal.test.js (new)
- tests/integration/sampleMonitoringOriginalProposalEmulator.test.js (new)

Exact commands/statuses are in final-checks.json; backend counts in backend-unit-final-results.json; real suite/emulator logs, private-evidence-audit.log, explicit-cleanup.json and preservation-audit.json are beneath the task artifact root. No generated test media or logs are staged in either repository.

**Recommendation: GO for local proposed-policy diagnostics and the preserved camera workflow. NO-GO for positive original-photo acceptance, original evidence reuse, enabling Upload Existing Photo or production activation.**
