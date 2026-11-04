# Phase 3C–4 frontend source remediation

Baseline: `6123e55763100eaa9f29d3cefa49b0de0c4ed63e`.

The monitoring page now isolates historical and pending evidence by authoritative visit/sample/revision context, scopes upload retry keys to the capture identity, ignores stale retrieval responses, clears state on context changes and revokes owned URLs. Two browser regressions exercise different visits containing TREE-001 and replaced/cross-visit pending previews.

SecureCameraCapture requests an uncached location again at frame capture. Existing 50 m accuracy, session, timestamp, image integrity and site validation remain active. Real Chromium acceptance changes the seeded location after preview and verifies the backend receives the fresh coordinates. Physical-device camera/GPS/EXIF acceptance remains pending.

Analytics loads authorized cursor-paged filter choices separately, applies selection in backend query parameters and displays safe exclusion counts. A large aggregate error no longer removes the choices needed to narrow scope. The selected-population cap still fails closed above 1000 visits. The information panel and requester inbox can page older requests; the backend's original array response remains available to older callers.

Six ordered-query index definitions were added to firestore.indexes.json, preserving all three notification indexes. Static contract tests and isolated real API query tests passed. Emulators cannot prove production composite indexes are built; no rules/index deployment occurred.

See the backend worktree's same-named document for query signatures, IAM/bucket/rule verification requirements, Android/iPhone physical test checklist, MENRO decisions and rollback/pilot design. Full application read-preserving write pause and server-enforced pilot allowlists are explicitly UNIMPLEMENTED. No retention/TTL, sampling, scheduling or official KPI policy was introduced.

Repository lint retains the unchanged baseline exception in VerifiedPlantingCohortsPage.jsx: lines 48/52 state-in-effect errors and line 57 missing selected dependency warning. Its blob remains identical to base 97087c9 (`0af80901a3f9722055ce3f457de5a8e34e619e09`). This is not a repository-wide lint PASS.

No production endpoint, credentials, IAM, bucket, gates, dependency manifests or deployment settings were changed. Generated logs/media, emulator records and graph artifacts are not release contents. Local source acceptance does not authorize production activation.

## Final executed acceptance

| Check | Result |
| --- | --- |
| Real Phase 3C aggregate | 5/5 PASS |
| Real Phase 3D/4 aggregate | 3/3 PASS |
| Real communication with evidence writes disabled | 3/3 PASS |
| Mocked frontend aggregate | 25/25 PASS |
| Frontend unit/safety/index tests | 65/65 PASS |
| Backend credential-free/security regressions | 169/169 PASS |
| Per-tree / evidence-workflow emulator regressions | 7/7 and 17/17 PASS |
| Independent-resource cleanup sentinel | 1/1 PASS |
| Scoped lint / normal Vite build / backend syntax / both diff checks | PASS |
| Repository-wide lint | FAIL: only the unchanged baseline exception above |

No skipped/flaky passes were inferred from earlier focused runs. The pending-preview test was corrected to wait for completed asynchronous verification rather than observing the previous preview. The final aggregate passed. An initial CORS assertion identified the original default header contract; the source fix preserves that contract while enabling requester idempotency independently.

The emulator environment was demo-menro-phase3c-isolated only (Auth9299/Firestore8281/Storage9298/Hub4401, exact isolated bucket, backend5185/frontend5186). Explicit UUID cleanup ran twice, preserved independent sentinels and left empty Auth/Firestore/Storage state. Only verified owned processes were stopped and all harness ports released. No production/shared-emulator data was accessed or modified.

Reviewed frontend files: `firestore.indexes.json`; `src/components/MonitoringInformationPanel.jsx`; `src/components/SecureCameraCapture.jsx`; `src/pages/MonitoringInformationPage.jsx`; `src/pages/PermanentSampleAnalyticsPage.jsx`; `src/pages/PermanentSampleMonitoringPage.jsx`; `tests/e2e/phase3c-real.spec.js`; `tests/e2e/phase3c-routing.spec.js`; `tests/e2e/phase3d4-real.spec.js`; `tests/phase3c/mocks/authenticatedApi.js`; `playwright.phase3d4-readonly-evidence.config.js`; `tests/monitoringIndexes.test.js`; this document.

Decision: GO for source-level production preparation with the documented existing lint exception. NO-GO for production activation pending index build verification, IAM/bucket/credential-remediation evidence, physical devices, MENRO policy/retention decisions and tested rollback/pilot controls. No push, merge, deployment or production activation occurred.
