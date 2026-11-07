# MENRO workflow and UI corrections - local acceptance

Date: 2026-11-07 (Asia/Manila).
Status: LOCAL GO for review of the requested scope. No commit, staging, push, merge, deployment or production activation performed.

## Implemented behavior

- Staff Dashboard omits the reporting coverage panel. Its calculations/component, other roles, cards, maps, charts, events and KPI definitions remain intact.
- One Staff Submit Seedling Request entry opens the shared four-step wizard. For a Requester is the default and uses the existing signed citizen/walk-in workflow. For Myself explicitly uses authenticated Staff identity. Changing modes remounts unsaved state; mode controls lock while submitting. Editing historical requests keeps their existing mode and IDs.
- Assisted By is read-only. The server derives the actual encoder UID/name from authenticated identity, ignoring supplied encoder claims. Citizen requester identity and private signed acknowledgements remain distinct. Requesters and assisting encoders cannot review, return, approve or release their request, even after a role change. Initial review remains independent Staff-only; Admin final approval is unchanged.
- My Requests is an ownership checkbox in the management filter row. It uses participantId, not encoder identity, and combines with New Planting/Replacement, search, status, barangay, dates and pagination.
- Official Staff report fields start with clean auto-fill placeholders. Linked request/event/distribution/site values populate after selection. Sector no longer falls back to organization. Missing data is labeled Not recorded; genuinely required missing relationships/coordinates block field-report submission with a correction notice.
- Both planting forms share photo buttons, counter, guidance, preview layout and photo/location section styling. Staff retains real EXIF parsing, session-verified camera capture and authenticated multipart upload. Leaflet site/evidence markers, boundary overlays and zoom controls remain available. Missing versus unreadable original GPS feedback is distinct from secure browser-camera evidence.
- Participant release/site/event changes revoke previews and invalidate files, descriptors, GPS diagnostics and upload-attempt state. Cleared preview IDs reject old EXIF completions, and immutable capture epochs reject old camera callbacks even after a new camera opens.
- The redundant Verified Planting Records sidebar entries are removed. Planting Reports embeds authorized read-only cohorts and source/quantity links; Survival Monitoring embeds existing sampling/baseline functionality. Existing bookmarked routes and APIs remain. Analytics has a contextual link to the existing gated approved-sample indicators. Pending policy disables sampling actions; no visit creation or scheduling is added. Existing approved baseline values display with cohort-scoped private-photo keys.

## Executed checks

| Check | Final result |
|---|---|
| Updated mock-boundary React form/UI browser aggregate | 43/43 PASS |
| Existing permanent-sample mock-boundary browser aggregate | 27/27 PASS |
| Existing Release/sidebar/topbar accessibility browser suite | 12/12 PASS |
| Real Auth/API/camera/private evidence/return/correction/Admin approval and attendance privacy browser suite | 2/2 PASS |
| Isolated coordinated request/citizen acknowledgement/release/policy snapshot emulator suite | 3/3 PASS |
| Isolated permanent-sample evidence lifecycle emulator suite | 7/7 PASS |
| Isolated evidence workflow Storage emulator suite | 17/17 PASS |
| Backend credential-free root regressions | 827/827 PASS |
| Frontend root unit/safety regressions | 206/206 PASS |
| Repository-wide frontend ESLint | PASS; no baseline exception in the current source |
| Scoped frontend ESLint | PASS |
| Normal Vite production build | PASS; existing large-chunk warning |
| Backend syntax (5 changed JavaScript files) | PASS |
| Both worktrees git diff --check | PASS |

Initial new browser assertions exposed a missing-global-styles defect in the mock entry and an imprecise cohort label. Both were corrected and rerun. Backend authorization test payloads were corrected to satisfy existing controller requirements before testing denial. The evidence suite initially stopped at environment preflight for missing explicit test variables/upload root; its completed isolated run passed all 17 tests without changing guards.

## Isolation, cleanup and limitations

Only the run-owned demo-menro-phase3c-isolated instance was used: Auth 127.0.0.1:9299, Firestore :8281, Storage :9298, Hub :4401; browser API :5185 and frontend :5186. Process ownership was verified from launcher PID 9464 creation time (2026-11-07 16:46:53), project command and descendants. Read-only preflight showed clean users, collections and bucket. UUID-scoped tests performed their own cleanup; explicit browser cleanup twice subsequently reported no active fixture. Final inventories had zero Auth users and Storage objects; only disposable counter metadata remained. The owned emulator tree exited and dedicated ports were verified released. No shared emulator data was queried or cleared.

The browser suite blocks unapproved remote origins; external map tiles/services were unavailable. Missing MapTiler configuration and existing test-server PassThrough listener warnings were observed, not suppressed. Local Leaflet boundaries/markers/zoom and responsive geometry were exercised. External basemap-service acceptance is not claimed.

Chromium media/geolocation fixtures prove the local capture/session/upload/retrieval pipeline, not physical Android/iOS camera, GPS accuracy, permission recovery or EXIF behavior. The reported original Android file was not supplied, so its exact metadata failure remains unconfirmed. MENRO sampling/retention/production policy approvals and physical-device acceptance remain separate. Existing site/area/document requirements were retained; no new household location exemption or Admin initial-review permission was invented. Previously audited badge palette and broader ID syntax changes are outside this implementation request.

## Exact changed files

Frontend:
- src/components/OfficialPlantingPhotos.jsx
- src/components/PlantingPhotoControls.jsx
- src/components/StaffPlantingReportForm.jsx
- src/layouts/Sidebar.jsx
- src/pages/DashboardPage.jsx
- src/pages/MonitoringPage.jsx
- src/pages/ParticipantSaplingRequestWizard.jsx
- src/pages/PlantingPage.jsx
- src/pages/ReforestationAnalyticsPage.jsx
- src/pages/SeedlingRequestsPage.jsx
- src/pages/VerifiedPlantingCohortsPage.jsx
- src/styles/planting-reports.css
- src/styles/seedling-requests.css
- src/utils/requestOwnership.js
- tests/e2e/workflow-forms.spec.js
- tests/phase3c/entry.jsx
- tests/requestOwnership.test.js
- docs/workflow-ui-corrections-acceptance.md

Backend:
- src/services/distribution.service.js
- src/services/officialPlantingReport.service.js
- src/utils/requestSeparation.util.js
- tests/officialPlantingReport.test.js
- tests/staffSeedlingRequest.test.js

Branches remain feature/phase3c-per-tree-monitoring and feature/phase3b-per-tree-evidence. HEADs remain e7b91789c7586de5815217e62fa570bbf955a5bd and c00f92b1ab310a3388900b5616f20effa232c85f. All changes are unstaged. Generated graphify-out artifacts and six ignored integration JPEGs were preserved. No dependency manifests, lockfiles, original worktrees, production Firebase, Vercel or Render settings were changed.

Screenshots and runner artifacts are local beneath TEMP/menro-workflow-acceptance-final, TEMP/menro-workflow-corrections-real-final and TEMP/menro-corrections-accessibility.

## Final UI review corrections and local-commit preflight

The final rendered review found mobile coverage-table overflow, a clipped sampling action and missing EXIF accuracy rendered as zero. These are corrected: coverage has a keyboard-focusable local scroll region, the sampling label wraps, and absent accuracy displays Not provided by EXIF. Staff photo cards/location details share the approved spacing and centered controls while retaining the server-verification distinction. Report/site references use existing authorized deep links; IDs remain unchanged internally.

Additional affected files: src/components/ReportingCoveragePanel.jsx, src/styles/reporting-coverage.css, src/styles/survival-monitoring.css. The other six latest UI/test files are included in the earlier file list.

Executed after the fixes:
- Focused rendered review at 320, 360, 390, 430, 768 and 1440px: 61/61 PASS.
- Populated Admin/Staff/Participant dashboards: 18/18 PASS.
- Workflow browser regression aggregate: 62/62 PASS; affected final rerun: 8/8 PASS; strengthened authorized link checks: 2/2 PASS.
- Frontend unit/safety: 206/206 PASS; backend official report/Staff requester regression: 25/25 PASS, repeated during commit preparation.
- Scoped and repository-wide frontend lint: PASS. Normal Vite build: PASS with existing large-chunk advisory. Both diff checks: PASS.
- Original EXIF fixture preview explicitly asserts missing accuracy is unavailable and is never 0.0 meters.

Browser review used isolated fixture Auth/API boundaries; no stored-data or production mutations. Physical-device camera/GPS and external basemap acceptance remain separate. Before/after screenshot artifacts remain outside Git in TEMP. Existing graphs and ignored JPEGs remain excluded. This section records acceptance before the authorized local commits; earlier unstaged/HEAD statements describe the earlier acceptance checkpoint, not the final committed state.
