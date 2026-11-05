# Combined workflow local acceptance — 2026-11-05

## Delivered behavior

- Successful login is announced once on the destination dashboard. Offline and unreachable-server messages are distinguished. Partial dashboard failures preserve successful data and show Unavailable instead of false zero metrics.
- Seedling Request uses inline accessible field errors, DOM-order first-invalid focus/scroll, selection-only barangays, conditional Other fields and backend field-error mapping. Other / Exact Area requires a finite positive decimal directly beneath its selector. Switching choices clears stale exact area. Proposed-site area may remain blank without changing coordinates/map selection.
- Staff supplies verified proposed-site hectares/capacity during review, then Admin approves registration. No invented area/capacity is assigned to new blank-area requests.
- Staff official planting reports use server-owned requester/release/Staff identity, species balances, separate planted/leftover quantities and optimistic versions. Admin verifies or returns them; corrections preserve earlier revisions. Individual release-based confirmation is explicitly distinguished from field observations. Optional attendance is private validated image/PDF evidence.
- Newly created cohorts use confirmed planted quantities, excluding leftovers. Existing cohorts, participant workflows, official KPI definitions, sampling rules and monitoring cadence are preserved. Existing timing compatibility for new records was explicitly approved.

## Executed results

| Check | Result |
|---|---|
| Frontend root unit/safety suites | 195/195 PASS, 44 suites |
| Combined mocked browser workflows | 10/10 PASS |
| Existing mocked permanent-sample browser suite | 25/25 PASS |
| Combined real Staff/Admin browser workflow and attendance RBAC | 2/2 PASS after locked backend install |
| Existing real permanent-sample browser aggregate | 5/5 PASS |
| Existing real requester communication/analytics browser suite | 3/3 PASS |
| Backend root unit/security suites | 777/777 PASS, 78 suites |
| Per-tree isolated emulator regression | 7/7 PASS after locked backend install |
| Evidence workflow isolated emulator regression | 17/17 PASS after locked backend install |
| Scoped frontend ESLint | PASS |
| Normal Vite production build | PASS; existing large-chunk warning |
| Backend syntax | PASS, 33 changed/new JavaScript files |
| Both worktrees diff check and unchanged manifests | PASS |

Repository-wide ESLint is **FAIL**, with two set-state-in-effect errors (lines 48/52) and one missing-effect-dependency warning (line 57) in VerifiedPlantingCohortsPage.jsx. Its blob remains byte-identical to base 97087c9: `0af80901a3f9722055ce3f457de5a8e34e619e09`. It was neither modified nor suppressed. This is the documented local acceptance exception, not a repository lint PASS.

Earlier backend aggregate attempts had intermittent localhost fetch failures in two HTTP harness suites; their standalone runs passed, and the final idle aggregate passed all 777 tests with no assertions changed. The initial Google Auth compatibility failure was caused by ancestor dependency resolution. User-approved `npm ci --ignore-scripts` installed exact locked dependencies locally; package/lock hashes did not change. No dependency upgrades occurred. npm reported seven moderate advisories, unresolved by this task.

Real browser assertions include canonical identity, 7 confirmed planted plus 3 leftovers from a release of 10 after correction, private original/corrected attendance retrieval, Admin verification, stale-version rejection, exact idempotent retry and Participant/non-owner/unauthenticated denial. Backend tests additionally cover concurrency, capture/revision/replay, quota and private storage validation. Browser camera simulation is not physical-device acceptance.

## Isolation and operations

Only demo-menro-phase3c-isolated was used for real integration: Auth 127.0.0.1:9299, Firestore :8281, Storage :9298, Hub :4401, API :5185 and frontend :5186. No shared emulator dataset was imported, queried or cleared. Real fixtures use UUID ownership checks; teardown explicitly executes cleanup twice. Mocked tests fail closed on unregistered requests and block remote traffic. Real browser tests block unapproved origins. External map services were intentionally unavailable in the credential-free harness; physical map-service acceptance is not claimed.

Final explicit cleanup of the latest two current-run fixtures returned zero remaining records, users and objects on both passes. The owned emulator tree was stopped only after verifying root PID creation time, project command, descendant relationships and dedicated listener ownership. Ports 9299/8281/9298/4401/5185/5186 were released; unknown/shared services were preserved.

Generated graphs, browser media, fixture manifests, logs, test output, secrets and node_modules are excluded from scoped commits. The original worktrees and unrelated files are preserved. No push, merge, deployment or production feature activation is authorized by local acceptance.

Production remains NO-GO pending MENRO visit/sampling/KPI and retention approvals, physical Android/iOS camera/GPS/EXIF testing, operational attachment reconciliation/retention, reviewed holiday updates and deployment/security preparation. The five-working-day message is advisory, not guaranteed approval/release. ID structure checks are not document authenticity verification.
