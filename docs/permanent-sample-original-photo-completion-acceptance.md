# Permanent Sample Monitoring: Original Photo Completion Acceptance

Date: 2026-11-12. Scope: isolated local proposed-policy implementation only. This report supersedes the earlier strict original-accuracy proposal for this local test path; it is not formal MENRO approval.

## Verdict

- **GO: isolated original-photo feature evaluation.** The real browser lifecycle and 11 original-photo emulator tests pass.
- **GO: local evidence regression closure after the test-contract correction.** The fresh follow-up completed evidence workflow 17/17, per-tree evidence 7/7 and original-photo 11/11, all exit 0. The earlier 15/17 results remain historical below; this is not production acceptance.
- **NO-GO: production enablement.** Formal MENRO policy approval and physical-device acceptance remain outstanding. Normal original uploads remain disabled.

## Implemented contract

The separate `POST /verified-sample-monitoring/visits/:visitId/samples/:sampleId/original-photo/verify` now validates one original JPEG and issues a short-lived server verification record. It does not create a browser-camera capture session or accept camera tokens as original proof. The existing private multipart `PUT .../samples/:sampleId/evidence` consumes the correct source-specific verification through the existing private evidence workflow.

The server resolves Staff ownership, approved cohort/site/plan/baseline, authorized Tree ID, visit version, assessment revision, saved Date Monitored, and assessment fingerprint. It extracts actual JPEG bytes and raw EXIF GPS/DateTimeOriginal/OffsetTimeOriginal. It rejects missing/invalid GPS or time, ambiguous timezone, future capture, a different Manila monitoring date, screenshots detectable by existing checks, out-of-site coordinates, unsupported formats, duplicate hashes and stale/foreign bindings. Current device GPS is never substituted for EXIF.

The original verification has a five-minute authorization lifetime, distinct from photo-age policy. SHA-256 comes from original bytes. The private upload preserves those bytes; the transaction rechecks current ownership/status, site, registered tree, plan/baseline, version/revision, assessment relevance, hash reservations and verification consumption. Existing create-only private storage, operation idempotency and authenticated retrieval are reused. Exact completed retries return the saved outcome without another link, including after approval; new uploads cannot be added to Approved visits.

EXIF is editable and is not authenticity proof. Independently trustworthy accuracy is unavailable, so every accepted original records `accuracyStatus: UNKNOWN`, `accuracyMeters: null`, and `verificationStatus: NEEDS_ADMIN_REVIEW`. An EXIF accuracy claim, when present, is kept separately as an untrusted reported value. GPS DOP is not interpreted as meters; missing accuracy never becomes zero. This is the newly selected local proposal, not a relaxation of camera precision. Camera sessions still require fresh device GPS at 50 m or better and retain nonce, ownership, hashing and replay validation.

## Form and Admin review

Staff can select JPEGs only when both the dedicated frontend proposal flag and backend guarded capability are present. The saved assessment/date must be current before selection. Each tree retains its own preview, verification, errors and pending upload across accordion/navigation changes. Verify Photo Location calls the actual backend, then private upload. Leaflet uses the returned EXIF coordinates and displays Unknown/Needs Admin Review rather than claiming authenticated precision. No public Storage URL is rendered.

Normal operation has a disabled Upload Existing Photo control and no file input. Admin and Approved views do not acquire Staff editing controls. Enabled operation is limited to `NODE_ENV=test`, explicit integration/form/proposal flags and the already-approved credential-free isolated monitoring topology. Invalid production, credential, project, bucket, remote-host and mixed-port declarations remain rejected. The normal Vite configuration is unchanged.

Admin approval requires explicit acknowledgments of the exact currently relevant original evidence IDs and revisions. Missing acknowledgments fail on the backend. The decision is recorded separately in visit history; original evidence metadata/history is not rewritten as independently accurate or authentic.

Unchanged evidence stays attached to the same Tree ID when its assessment and Date Monitored remain unchanged. It is not re-uploaded or relinked. Any changed condition, measurement, normalized remarks, investigation/search findings or monitoring date conservatively requires replacement evidence before submission/approval. Old revisions remain retrievable. No new nonmaterial-change exemption, universal per-tree photo mandate, Not Located rule or future scheduling policy was invented. Save Draft remains available for incomplete assessments.

## Completed test results

| Check | Actual result |
| --- | --- |
| Default-mode real browser: actual Auth/API, RBAC, camera, GPS rejection, private evidence, full Staff/Admin lifecycle, originals disabled | **6/6 PASS** |
| Proposal-mode real browser: two original trees, distinct EXIF map points, invalid GPS inline error, lost-response retry, Return/correction/reuse/resubmit/explicit approval and protected history | **1/1 PASS** |
| Mocked Phase 3C browser regressions | **27/27 PASS** |
| Seven-section form/responsive/recovery browser regressions | **24/24 PASS** |
| Frontend unit/safety tests | **53/53 PASS** |
| Backend unit regressions, 28 separate processes, including original proposal 38/38 | **265/265 PASS** |
| Per-tree camera evidence emulator regression | **7/7 PASS** |
| Monitoring form emulator regression | **4/4 PASS** |
| Original-photo emulator contract/lifecycle regression | **11/11 PASS** |
| Broader evidence workflow regression (original run, before test-only correction) | **15/17 PASS, 2 FAIL** |
| Same broader suite using task-start monitoring runtime source snapshots in memory | **15/17 PASS, same 2 FAIL** |
| Backend JavaScript syntax | **14/14 PASS** |
| Final scoped frontend ESLint | **PASS** |
| Final repository-wide frontend ESLint | **PASS** |
| Final normal production Vite build | **PASS** |
| Both worktrees `git diff --check` | **PASS** |

The browser fault-injection test lets the real backend complete the first upload, then drops only its response. Manual retry uses the same Idempotency-Key and leaves one immutable evidence link. Storage audit downloaded all three browser-original objects and confirmed their SHA-256 against Firestore. TREE-001 retained revisions [0,1]; unchanged TREE-002 retained [0]. Owner Staff and Admin retrieval succeeded; Participant/nonowner/unauthenticated access was denied. Separate emulator tests cover incorrect visit/tree/file/version/revision, expiry, duplicate bytes, consumed verification replay, stale writes and exact completed retries.

### Historical failures subsequently resolved by test-only contract corrections

1. `tests/integration/evidenceWorkflowEmulator.test.js:330`: guest contribution evidence expects 401 but the retired guest route returns 410.
2. Same file at line 358: an incremental request-linked contribution fixture expects 201, while the current One Final Planting Report rule returns 409: 'Submit one final planting report covering every released seedling type.'

Both failures reproduced with every monitoring runtime module changed by this task replaced **in memory** with its task-start snapshot. No repository files were restored/switched. The affected Guest Attendance/Planting Report code and the failing suite were not edited. Their obsolete fixtures/contracts require separate review; re-enabling retired routes or bypassing final-report validation is not an acceptable fix.

One fresh verification attempt hit a bounded 30-second discovery-response timeout before uploads. The unchanged application subsequently passed the bounded rerun; no timeout was increased or automatic retry added to hide it. Cold-emulator timing remains an environment limitation, not a confirmed original-photo defect. Existing test warnings include unavailable isolated MapTiler credentials, blocked remote basemap tiles, Vite/exifr import analysis, large production chunks, and an emulator rules-runtime shutdown warning. Successful runs still exited zero and released their owned ports. Leaflet site/tree/evidence markers and local boundary requests were tested; external basemap service availability was not.

## Isolation and cleanup

- Real services: frontend 127.0.0.1:5186, backend 127.0.0.1:5185.
- Disposable demo project: `demo-menro-legacy-monitoring-20261106`.
- Auth 9399, Firestore 8381, Storage 9398, Hub 4402; bucket `demo-menro-legacy-monitoring-20261106.firebasestorage.app`.
- Unique temporary working/data root; no shared exports/imports. Each run verifies clean Auth/Firestore/Storage before seeding and an empty isolated dataset afterward.
- Browser external origins are blocked. The lost-response forwarding request refuses redirects. No Auth/API/component aliases or fake camera tokens were introduced.
- Explicit authoritative UUID cleanup includes original verifications, sessions, hash reservations, upload intents, workflow/quota artifacts, visit/site/cohort/users and referenced private objects. The browser-original cleanup removed 32 fixture records, four users and three objects; the second pass removed zero. Camera cleanup likewise passed twice (42 records, four users, three objects; then zero).
- All harness ports 9399/8381/9398/4402/4502/9152/5185/5186/5184 were released. The unrelated 8281 listener was left untouched.
- Both `kyla` branches, HEADs and staging contents remain unchanged. Every unrelated initial file hash is preserved; all 46 ignored JPEGs and both manifests/lockfiles are unchanged. No commits, push, merge, deployment or production configuration changes occurred.

## Exact repository files changed by this task

Frontend:

1. `src/pages/PermanentSampleMonitoringPage.jsx` - guarded original selection/verification/upload, stable retries, specific errors, Admin acknowledgments and safe original-source display.
2. `src/components/PermanentSampleVisitForm.jsx` - conditional JPEG picker, per-tree preview/errors/maps and honest Unknown-accuracy labeling.
3. `vite.sample-monitoring-real.config.js` - dedicated test-only proposal define.
4. `playwright.sample-monitoring-real.config.js` - explicit selection of normal or proposed-original real-browser spec.
5. `tests/e2e/sample-monitoring-original-real.spec.js` - new real-service original lifecycle/retry/map/review acceptance and sanitized request diagnostics.
6. `tests/e2e/permanent-sample-form.spec.js` - replace superseded accuracy-policy wording assertion; retain disabled-control/no-file-input checks in normal mode.
7. `docs/permanent-sample-original-photo-completion-acceptance.md` - this report.

Backend:

1. `src/config/sampleMonitoringOriginalProposal.js` - permit the new Unknown/review policy only inside existing exact isolated guards.
2. `src/controller/sampleMonitoringOriginalPhoto.controller.js` - real verification result and stable request-key forwarding.
3. `src/services/sampleMonitoringOriginalPhoto.service.js` - EXIF/context verification records, file binding, expiry and transactional consumption.
4. `src/services/sampleMonitoringOriginalEvidence.js` - new assessment relevance and exact Admin acknowledgment helpers.
5. `src/services/sampleMonitoringEvidence.service.js` - source-specific original proof, private saga linkage and final transaction rechecks; camera contract preserved.
6. `src/services/evidenceCaptureSession.service.js` - extract shared site-geometry validation while preserving camera accuracy checks.
7. `src/services/sampleMonitoringVisit.service.js` - relevant-original checks at submit/approval and separate Admin audit.
8. `src/controller/sampleMonitoringVisit.controller.js` - safe original DTO/capability/review requirements and acknowledgment forwarding; private references remain stripped.
9. `tests/integration/phase3cBrowserFixtureCleanup.js` - authoritative UUID ownership checks and cleanup of original verification records.
10. `tests/helpers/sampleMonitoringOriginalPhotoFixtures.js` - clarify synthetic protocol fixture status.
11. `tests/sampleMonitoringOriginalProposal.test.js` - selected proposal safety/EXIF/Unknown/relevance checks.
12. `tests/integration/sampleMonitoringOriginalProposalEmulator.test.js` - real source/binding/upload/retrieval/retry/correction/Admin tests and scoped cleanup.

Existing routes, Planting Report components/services, shared map implementation, normal Vite config, dependencies, schedules and unrelated worktrees were not changed by this task.

## Reproduction and local evidence

Temporary artifact root: `C:/Users/chuak/AppData/Local/Temp/menro-original-complete-f2i1fch3`.

- `normal-final-evidence/`: default six-test browser run, 7+4+11 emulator results, broader 15/17 result, persistence audit and cleanup.
- `baseline-evidence-confirmation/`: independent task-start 15/17 reproduction.
- `original-final-evidence/`: final original-browser PASS, real private persistence and two-pass cleanup.
- `final-checks.json`, `backend-unit-final-results.json`, `syntax-final.json`, `text-final-results.json`, `final-preservation-audit.json`: exact execution and preservation records.
- `browser-results/sample-monitoring-original-07dcb-and-explicit-Admin-approval/originals-approved.png`: final reviewed screenshot.

The dedicated Playwright command is `node node_modules/@playwright/test/cli.js test --config playwright.sample-monitoring-real.config.js --reporter=list`, executed by the credential-free temporary launcher. The backend proposal flag selects the original spec and dedicated Vite define only within that isolated process; omit it for the unchanged default six-test suite. Do not copy these flags into deployed environments.

## Remaining approval and physical-device work

Formal MENRO approval is still required for original-photo admissibility, EXIF trust/Unknown-accuracy review, timezone handling, same-day/age rules, correction/date-change reuse, and production retention/enablement. A changed Date Monitored currently requires new matching evidence for all original-bearing assessments; no exemption was invented. Universal photographic requirements for Needs Rechecking/Not Located and automatic future schedules remain separate unresolved policies, unchanged here.

Physical Android Chrome and iOS Safari testing must use genuine untouched device JPEGs: gallery permissions, preservation/stripping of EXIF GPS and timezone, missing/poor accuracy labels, current vs wrong monitoring date, future device clocks, correct/outside-site locations, camera <=50 m behavior, HEIC/unsupported-file rejection, per-tree map alignment, upload interruption/resume and private authorized display. Verify genuine capture/retrieval and Admin review on devices; synthetic EXIF and Chromium media prove protocol behavior, not real-world provenance, physical GPS precision or authenticity. No physical-device or production acceptance is claimed.

## 2026-11-12 test-contract regression closure addendum

A fresh isolated follow-up, after corrections confined to backend `tests/integration/evidenceWorkflowEmulator.test.js`, completed:

| Suite | PASS | FAIL | Exit |
| --- | ---: | ---: | ---: |
| Evidence workflow emulator | 17 | 0 | 0 |
| Per-tree evidence emulator | 7 | 0 | 0 |
| Original-photo emulator | 11 | 0 | 0 |

The retired guest evidence endpoint remains HTTP 410 without new evidence or balance/quota changes. The final Planting Report fixture now uses HTTP `items`, the actual inventory ID, and 75 leftovers from 100 released seedlings, preserving 25 planted, stable idempotency, private evidence linkage/retrieval and pending review. No application behavior changed in that test-only correction. The original 15/17 and task-start reproduction above remain valid historical executions, not current unresolved failures. These suites overlap earlier runs and are not added to a combined test count.

Evidence: `%TEMP%/menro-evidence-contract-5c623db9-a404-4028-b290-b8058eabd672/recheck-run-e0753588-5ee1-4123-8898-ee7153f40c6d/results.json`, plus the parent `final-results.json`. The follow-up records fixture cleanup, owned-port release and preservation checks. No acceptance of physical devices, official scheduling, universal per-tree photo mandates or production original-photo policy is implied.

## Reproduction prerequisite disclosure

The repository contains the real browser specs, Vite/Playwright configuration, fixture server, persistence audit and UUID cleanup. The accepted startup/verification coordinators `run.py` and `inside.cjs`, with aggregate drivers `final_verify.py` and `finish.py`, currently reside only in the temporary artifact root above. They create the run-local `before.json`, `original-photo.json`, proposal-only `proposal-originals.json`, Firebase CLI configuration and rules; set consistent TEMP/TMP and credential-free environment values; verify ownership and clean state; and perform recovery cleanup/shutdown. A fresh checkout therefore does not yet reproduce the complete accepted run without that external setup. A reviewed repository-owned coordinator or complete executable procedure remains follow-up work; generated snapshots, media, logs and fixture data must not be committed. Normal builds do not select this configuration or enable the original-photo proposal.
