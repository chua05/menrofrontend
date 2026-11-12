# Permanent sample monitoring: remaining-function completion acceptance

> Pre-commit reconciliation (2026-11-12): Historical secure-camera completion snapshot. The original-photo contract blocker below was subsequently resolved only for guarded local proposal evaluation in permanent-sample-original-photo-completion-acceptance.md. Universal per-tree photo rules, official future scheduling and production enablement remain policy-dependent. Historical results below are retained unchanged.

Local task completed 2026-11-12. No commit, staging, branch change, push, merge, deployment, production access, dependency change or production gate activation.

## Scope and preserved work

Active implementation worktrees were `C:/tmp/menro-kyla-frontend` (`kyla`, HEAD `e198197a94d5b5a8c71cbfb0caf1cab76b31bfc7`) and `C:/tmp/menro-kyla-backend` (`kyla`, HEAD `d7a5eac66ee4b730fb423454d8715643763d83d3`). The existing form and real-service acceptance reports were inspected first. This report describes additions to that already uncommitted implementation; it does not attribute all existing worktree changes to this task. Original Desktop worktrees, generated graphs, unrelated Guest Attendance/Leaflet work and ignored JPEG artifacts were preserved.

## Confirmed defects corrected

1. Tree accordion buttons previously could not truly collapse because the first assessment was always used as a fallback. They now collapse/reopen and retain unsaved fields; Previous/Next navigation remains functional.
2. Reloading/changing visits could discard unsaved assessment/photo/question state. A saved-draft snapshot now guards destructive reload, selection, filtering and pagination with explicit discard confirmation. Canceled actions retain entries; closing/reopening the same visit retains them. Existing uncertain-write reconciliation and stable evidence retry handling remain intact.
3. Unsent requester questions were owned by a child component and could be lost on remount. The visit now owns them, preserves them across tree collapse and canceled reload, and offers explicit discard when a changed condition hides the question. Draft saving remains possible. Final Submit identifies and focuses an unsent question instead of silently dropping it. A question already sent and still awaiting a requester reply does not block submission.
4. Resolving Needs Rechecking could leave an obsolete required-remarks/search error visible. Those conditional errors now update with the condition while ordinary length/measurement validation remains active.
5. A targeted security test confirmed that the existing capture binding predicate skipped numeric zero (`value && ...`). Explicit null/empty checks and nullish comparison now enforce visitVersion 0 and assessmentRevision 0 against different or missing session values. Before correction: 1/4 focused tests passed; after correction: 4/4. Roles, source identity, GPS limits, nonce/hash, expiry, replay, private storage and idempotency protections remain intact.

Only directly related harness issues were corrected: real navigation waits for the exact collection response after opening the actual sidebar; direct guarded-route tests wait for actual session verification. The mocked loading response now has an explicit test-release gate instead of relying on a 150 ms race. A destructive evidence-switch test explicitly accepts the new discard confirmation.

## Final executed checks

The final coordinator completed with exit 0 after all current source/test fixes. Counts below are final aggregate runs, not sums of earlier reruns.

| Check | PASS | FAIL |
| --- | ---: | ---: |
| Real React/Auth/API/Express/Auth-Firestore-Storage browser aggregate | 6 | 0 |
| Existing mocked Phase 3C routing/discovery/evidence/review suite | 27 | 0 |
| Seven-section form browser suite | 23 | 0 |
| Frontend unit/source/safety regressions (8 files) | 53 | 0 |
| Backend offline lifecycle/security/policy/regression tests (27 suites) | 225 | 0 |
| Real per-tree evidence emulator regression | 7 | 0 |
| Real form/clarification/RBAC emulator regression | 4 | 0 |
| Backend JavaScript syntax checks | 19 files PASS | 0 |
| Scoped frontend ESLint | PASS | 0 |
| Repository-wide `npm run lint` | PASS | 0 |
| Normal Vite production build | PASS | 0 |
| `git diff --check`, both worktrees | PASS | 0 |

The current repository-wide lint run exited 0; historical baseline exceptions are not being carried forward as current failures. The build still reports its existing large-chunk warning. Early failed reproductions and harness reruns remain in the local artifact root and are not represented as passing final aggregates.

### Actual real-browser assertions

- Real Staff/Admin email/password Auth Emulator login, actual protected routes, authorized collection/detail responses and both authoritative Tree IDs.
- Unauthenticated, Participant and non-owner Staff route/API denial. Uploaded-original sources remain rejected for each tree.
- Real SecureCameraCapture keyboard/click access, live MediaStream, nonzero video dimensions, canvas JPEG generation, real session creation/verification and actual private multipart upload.
- Per-tree GPS rejection feedback; distinct pending previews, registered-tree/evidence Leaflet markers, locations and evidence links. Cross-tree capture rebinding is rejected.
- Staff draft and whole-visit submit; Admin Return with required reason; owner correction; new revision capture/upload; resubmit; Admin Approve and Staff read-only behavior.
- Actual saved TREE-002 question/revision binding, Request Information notification, Participant Answer This/reply flow, and rejection of Staff impersonating the requester. An OPEN unanswered question does not block monitoring submission.
- Stale visit writes return 409; exact stable-key evidence retry resolves without duplicate links, including after approval. Participant/non-owner/unauthenticated historical retrieval is denied. No public Firebase Storage URL is rendered.

A privileged emulator audit independently read three stored private JPEGs and verified their stored SHA-256 against their bytes. TREE-001 retains revision [0]; TREE-002 retains [0,1], correct assessment revision and distinct recorded capture locations. Browser Admin retrieval decoded both historical revisions. Approval did not change the stored visit date or create a next date.

Backend-only regressions additionally cover expiry, malformed camera bytes, 49/50/51 m accuracy boundaries, missing accuracy, municipality/site polygon or radius limits, nonce/hash/replay rejection, authoritative plan/baseline binding, unchanged legacy schedules and Staff/Admin monitoring reminders. These are not physical-device assertions.

## Seven-section and enabled-control assessment

| Section/control | Verified behavior and boundary |
| --- | --- |
| 1. Verified planting site/report selection | Selects existing API-authorized visits and displays their authoritative report/site/context. It does not create a visit for an arbitrary report. Species and verified total are displayed; unsupplied per-species quantities are not fabricated. |
| 2. Schedule/date | Displays supplied schedule/readiness values; actual assessment date is separate and cannot be future. Missing approved future dates remain pending. |
| 3. Progress | Derived assessed/rechecking/unassessed counts and progress; no editable aggregate totals. |
| 4. Tree records | Every authoritative ID, true expand/collapse, Previous/Next and retained unsaved edits. |
| 5. Individual assessment | Prior baseline/approved history, measurements, condition, remarks, secure Take Photo, tree-specific verification/upload, private historical photos and independent Leaflet tree/evidence markers. Current/history content is inline rather than literal tab styling from the illustrative blueprint; pixel-identical reproduction is not claimed. |
| 6. Rechecking/clarification | Conditional notes/search fields, existing Not Located outcome, saved-tree/revision question, real notification/reply. Follow-up refers to an approved next visit; none is invented. |
| 7. Summary/actions | Derived condition totals, optional visit remarks, partial Save Draft, one Submit, whole-visit Admin Return/Approve, loading/field/server/timeout feedback and approved read-only. |

Form tests passed at 320, 360, 390, 430, 768 and 1440 px. Screenshots at 320 and 1440 px were visually inspected: sticky header/footer, scrollable body, readable controls and no document horizontal overflow. Test OSM tiles are deliberately blocked; gray basemaps are not proof of live tile availability. Real Leaflet vectors/markers and interaction are exercised.

Unavailable original uploads are disabled with a contract explanation; location upload is disabled until a verified capture exists. Requester clarification is disabled until the relevant saved state and environment authorization permit it. No enabled placeholder action, Create Visit/manual-ID/scheduling/testOnly UI was added.

## Policy-dependent requirements: not implemented or claimed accepted

### Original geotagged uploads ? NO-GO pending source policy and API contract

`src/services/evidenceCaptureSession.service.js::resolveSubmissionEvidence` recognizes `source: browser-camera`. `src/services/sampleMonitoringEvidence.service.js` requires the resulting verified session and rejects an unsupported original source. Current camera sessions bind actor, workflow, cohort/site, Tree ID, plan/baseline, visit version, assessment revision, nonce, image hash and expiry. A current location or newly minted camera session cannot establish an older file's provenance.

No approved original-file admissibility, provenance standard or acceptable age was found in the inspected policy/services/reports. Upload Existing Photo remains disabled. MENRO must first define accepted sources/formats, timestamp/age/timezone requirements, GPS/accuracy presence and provenance expectations, and how a historical image can bind the current tree/revision. A future distinct original-photo contract must validate original bytes/EXIF server-side, preserve source identity, ownership/site/tree/revision/hash/private storage/duplicate protection, and never replace missing EXIF GPS with device GPS or label the original as camera evidence.

### Mandatory per-tree photos ? NO-GO for a universal completeness claim

The existing contract, unchanged by this task:

| Condition/outcome | Current assessment rule | Current photo completeness rule |
| --- | --- | --- |
| Healthy / Damaged / Dead | An accepted condition for every sample on final submit; finite nonnegative measurements when supplied | No universal current-revision photo requirement in save/submit/approval |
| Needs Rechecking | Nonblank remarks; unresolved queue retained | Attached evidence is strictly verified, but no universal photo count rule |
| Not Located After Rechecking | Separate outcome only under Needs Rechecking, with documented search findings | No approved universal search-photo/exemption rule |

Drafts permit unassessed trees; selecting a condition with required notes still invokes its existing validation. Admin approval revalidates authoritative assessments/references and approved plan/baseline. Existing history is preserved on return/correction; that preservation is not a claim that an older photo proves a newer assessment.

MENRO must approve the condition/outcome evidence matrix, required number/type, current-revision versus carry-forward acceptance, correction-specific refresh requirements, and Not Located/search-investigation eligibility. Only then should the same completeness policy be applied at frontend final Submit, backend submission and Admin approval. No additional mandate or exemption was invented.

### Automatic permanent-sample scheduling ? NO-GO pending approved lifecycle rules

`src/services/purposePolicy.service.js::samplingReadiness` can derive first eligibility from actual planting date and a supplied approved firstVisitDelayWeeks. Minimum target, selection procedures and first delay can remain pending; configured percentage/interval defaults are not approval to create permanent-sample visits. It explicitly returns automaticCreationEnabled: false. `sampleMonitoringVisit.service.js::create` refuses non-testOnly future creation with the existing policy-approval error.

Required approvals: first eligibility/approval prerequisites, interval/next-date basis, recheck timing, ownership/assignment permissions, overdue/missed treatment, duplicate-safe creation, policy version/effective-date handling and treatment of existing records. No legacy aggregate 14/35-day/monthly cadence was applied, no dates or future visits were manufactured, and official legacy schedules/history were unchanged.

## Isolated environment, cleanup and limitations

The already supported disposable demo topology was used: project `demo-menro-legacy-monitoring-20261106`, Auth 127.0.0.1:9399, Firestore 127.0.0.1:8381, Storage 127.0.0.1:9398, Hub 4402, logging 4502, websocket 9152; backend 5185, frontend 5186. Mocked tests used localhost 5184 separately.

Fresh empty Auth/Firestore/Storage were verified before UUID seeding. Temporary config, deny-all client rules, fixture files, media and data stayed beneath this run's unique temporary root, with no shared import. Credentials were rejected, dotenv read no project environment file, proxy targets were a closed loopback port, and browser external requests were blocked (OSM tiles explicitly aborted). Real AuthProvider/authenticatedApi/App/SecureCameraCapture were used in the real suite; no mock aliases.

Explicit browser cleanup removed 40 owned records, 4 users and 3 referenced objects. Second cleanup removed 0/0/0. Final and post-regression checks found empty Auth, Firestore and Storage. Only verified run-owned processes were shut down; all run ports were released. The pre-existing 8281/PID 30892 listener was not contacted/reused/stopped and retained its recorded parent/creation identity. Shared datasets were never queried or modified.

Non-failing tooling warnings retained: Vite large bundle, exifr dynamic-import analysis, optional dashboard MapTiler key, SDK PassThrough listener warnings, and Firebase Storage rules-runtime NullPointerException during shutdown after successful tests/cleanup and exit 0. No unrelated warning suppression or infrastructure refactoring was applied.

Physical Android Chrome/iOS Safari camera, real GPS, EXIF/file conversion, permission/recovery, offline/background/interruption and actual field-boundary acceptance remain NOT EXECUTED. See `permanent-sample-monitoring-device-checklist.md`. Simulated Chromium media/geolocation cannot prove physical-device accuracy or adversarial GPS spoof resistance.

## Exact files changed in this task

Frontend (existing changes in these files were preserved/extended):

- `src/pages/PermanentSampleMonitoringPage.jsx`
- `src/components/PermanentSampleVisitForm.jsx`
- `tests/e2e/permanent-sample-form.spec.js`
- `tests/e2e/sample-monitoring-real.spec.js`
- `tests/e2e/phase3c-routing.spec.js`
- `tests/phase3c/mocks/authenticatedApi.js`
- `docs/permanent-sample-monitoring-device-checklist.md` (new)
- `docs/permanent-sample-monitoring-completion-acceptance.md` (new, this report)

Backend:

- `src/services/evidenceCaptureSession.service.js` (one binding predicate correction)
- `tests/sampleMonitoringCaptureBinding.test.js` (new)

No manifests, lockfiles, production Firebase/auth configuration, scheduling policy, unrelated source, Git history or index entries were changed. Existing uncommitted implementation and unrelated files remain uncommitted.

## Local evidence and commands

Artifact root: `C:/Users/chuak/AppData/Local/Temp/menro-monitoring-completion-ajdomo_m`.

- Final runner: `final_verify.py`; aggregate outcomes: `final-checks.json`.
- Backend counts: `backend-unit-final-results.json`; syntax: `syntax-results.json`.
- Real run: `real-aggregate-final.log`, `browser.log`, `emulator.log`, `emulator-regression-results.json`.
- Private integrity/cleanup: `private-evidence-audit.log`, `explicit-cleanup.json`, `recovery-cleanup.log`.
- Responsive screenshots: `form-browser-results/permanent-sample-form-form-and-interactive-map-fit-<width>px/monitoring-form[-top]-<width>.png`.
- Real approved-visit screenshot/diagnostics: `browser-results/` beneath the run root.

The exact commands and statuses are retained in final-checks.json. The real run must use the reviewed temporary coordinator and its preflight; do not launch it against occupied/shared endpoints or copy demo flags into production. The coordinator runs the dedicated `playwright.sample-monitoring-real.config.js`, then the two named emulator regressions, and verifies cleanup before shutdown.

## Recommendation

GO for the supported local secure-camera, assessment/draft/review/revision, per-tree map/evidence and authorized requester-clarification scope. NO-GO for enabling original uploads, claiming mandatory current-revision evidence completeness, automatic official future scheduling, physical-device acceptance or full production acceptance until the respective policy/contract/device gaps are closed. No deployment or commit is implied by this local result.
