# Coordinated MENRO workflow acceptance ? 6 November 2026

## Outcome and limits

Conditional LOCAL GO for the implemented, policy-gated new-record workflow, with the documented repository lint exception. PRODUCTION NO-GO. No push, merge, deployment, production data access, environment change or production feature activation occurred. Existing feature branches were retained.

All sector options and their order remain unchanged except `School / Student`, which becomes `Student (Individual)` and `School Organization Representative`. Student is individual; School Organization Representative is organization. Legacy ambiguous school records remain readable and require an explicit classification when corrected. Other retains its existing conditional type/specification. Purpose is independent and shared: Household/Backyard, Agroforestry/Fruit Tree, Reforestation/Mangrove/Riverbank/Slope, School/Community/Roadside Greening, Replacement Planting, Special Occasion and Other. No distinct corporate purpose or MENRO policy approval is invented.

## Executed acceptance

| Check | Completed result |
|---|---|
| Backend offline unit/security/safety aggregate | 815/815 PASS; 81 files |
| Frontend offline unit/safety aggregate | 204/204 PASS; 47 files |
| Coordinated mocked browser workflows | 32/32 PASS |
| Existing monitoring mocked browser suite | 25/25 PASS |
| Modal/sidebar/topbar accessibility browser suite | 12/12 PASS |
| Real Auth/API/camera monitoring aggregate | 5/5 PASS, including return/correction/resubmission/approval and evidence revisions 0 and 1 |
| Real Staff official planting/attendance browser regression | 2/2 PASS |
| New real-backend request/policy/walk-in acceptance | 3/3 PASS |
| Per-tree evidence emulator acceptance | 7/7 PASS |
| Evidence lifecycle/idempotency/replay/retrieval emulator regression | 17/17 PASS |
| Scoped lint excluding baseline-affected cohort page | PASS |
| Repository-wide lint | FAIL: the same 2 hook errors and 1 dependency warning reproduced from HEAD |
| Vite production build | PASS; existing large-chunk advisory remains |
| Backend syntax | PASS for changed/new JavaScript |
| Frontend/backend git diff --check | PASS |

The focused policy, classification, request, sampling and quantity tests are included in the backend aggregate; do not add them again to that total. Mocked browser tests use deterministic boundaries. Real-service tests use the actual React/AuthProvider/authenticated API, Express authorization, Firebase Admin transactions and private emulator Storage. Deterministic video/GPS is not physical-device acceptance.

## Lint baseline evidence

`git show HEAD:src/pages/VerifiedPlantingCohortsPage.jsx | eslint --stdin --stdin-filename src/pages/VerifiedPlantingCohortsPage.jsx` independently reproduces `react-hooks/set-state-in-effect` at original lines 48 and 52 and `react-hooks/exhaustive-deps` at original line 57. Current locations are 49, 53 and 58. No rule was suppressed or unrelated hook refactored. This page **is modified** for the requested new-policy target/readiness behavior; it is not described as byte-identical. All other changed frontend files lint without findings.

## Policy, identity and accounting contracts

- Admin GET/PUT `/api/purpose-policies` uses `expectedVersion`, an effective date, an audit reason, the supported purpose definitions and nullable sampling policy fields. Immutable `purposePolicyVersions` record actors and times. Future settings do not apply early. Already-approved request snapshots never change when settings change.
- Staff proposes a reporting/monitoring decision with a reason during review. Admin approval uses the existing request approval route with a reasoned `policyDecision` and effective `expectedPolicyVersion` when overriding/settling unresolved policy. Staff cannot finalize Admin approval. Unknown threshold/organization precedence and Other require explicit Admin resolution.
- Reporting statuses resolve from actual released quantities. Household NOT_REQUIRED produces Released ? No Report Required; OPTIONAL has no overdue obligation; CONDITIONAL becomes required only strictly above its approved released-quantity threshold. Existing inventory and distribution ledgers remain authoritative.
- POST `/api/seedling-requests/walk-in` accepts multipart `request`, signed `acknowledgement` and optional request letter. Actual citizen identity is separate from the verified Staff encoder; no citizen account is created. Acknowledgements are byte-validated and private. Public request DTOs omit object paths and encryption details. Only Staff/Admin can retrieve them through the protected acknowledgement endpoint.
- Returned walk-ins retain request identity and signed-document history. The original encoder can record a new signed schedule acknowledgement through PATCH `/api/seedling-requests/walk-in/:id/schedule`; normal schedule/version validation remains active, and a different officer decides the late replacement schedule. Staff role cannot approve requests; a promoted original encoder cannot Admin-approve their encoded request.
- New policy-backed requester confirmations prefer final mode; legacy records retain partial mode. Final planted equals the **current authoritative remaining balance** minus final leftovers. Tests verify 100 = 80 + 20 and partial 60 / future 40 followed by final 30 / leftover 10, with 90 accepted planted. Pending submissions do not become confirmed totals. Duplicates, concurrent overconsumption and altered retries retain backend rejection.
- Staff/Participant forms remain distinct. Shared photo controls use the real capture component and backend evidence validation. GPS is not fabricated, uploaded-original EXIF preview is not labeled server verification, maps use authoritative site/photo markers and barangay boundaries, and changed releases discard stale selections. Remarks and optional private attendance follow the map in stable order. Dialog focus/backdrop protections are retained.

## Monitoring and analytics coexistence

New purpose-policy reports do not create requester aggregate monitoring assignments or legacy reminder obligations. New permanent-sample submission/review retains Staff/Admin-only RBAC. **Legacy aggregate access, recipients, schedule dates and official KPIs are unchanged.** A broader legacy conversion was not applied; the earlier authorization question remains separate from this new-record implementation.

New eligible cohorts snapshot their approved policy. Sampling uses one capped, rounded cohort target, never independently rounded species totals. Minimum, species-allocation procedure, physical selection procedure and first-visit delay remain pending when unapproved. New plans require species/site identity consistency; no automatic selection algorithm or visit creation is introduced. The default interval is 12 months for new policy snapshots. `STAFF_SPOT_CHECK` is a policy designation, not an automatically created assignment or a newly invented field procedure.

Estimates require complete, resolved, approved permanent-tree observations plus explicit Admin sampling-validity approval for the same policy version. Healthy plus Damaged counts as living under the accepted condition taxonomy. Estimates are labeled, unavailable when invalid/incomplete, and never replace historical aggregate KPIs. Reporting coverage excludes optional/exempt requests; absent verification remains unknown rather than verified zero.

## Isolation and cleanup

Only the disposable `demo-menro-phase3c-isolated` project was used: Auth 127.0.0.1:9299, Firestore :8281, Storage :9298, Hub :4401, backend :5185 and frontend :5186. Read-only checks proved zero users, collections and objects before seeding. Real browser harnesses block unexpected origins. No shared emulator endpoint or production credential was used.

New request fixture cleanup now verifies request/citizen/encoder/site ownership, linked events and encrypted identification children, signed-document upload intents and object generation/scope metadata. Its final run removed 67 created records and two private documents; a second pass removed zero records/objects. Existing browser teardown executes UUID cleanup twice. A failed early test setup was confined to this newly owned disposable instance; stopping that instance discarded its unexported state. No shared dataset was cleared or imported. All dedicated listeners were released after verifying the recorded launcher's command, creation time and descendant ownership.

## Remaining MENRO and device decisions

1. Approved Agroforestry threshold, organizational precedence where not explicitly configured, minimum sample, species allocation/random selection procedures and first-visit delay.
2. Who creates official visits, authorized scheduling/activation and any legacy monitoring migration. Automatic sample/visit creation remains disabled.
3. Official KPI/reporting use of estimates, data retention and requester visibility policy; no approvals inferred.
4. Real Android/iOS camera permission/GPS accuracy/location mismatch/offline/interruption/EXIF/device timestamp/duplicate-photo tests. Browser simulation does not prove these physical behaviors.
5. Deployment/index/rule/config review and explicit rollout authorization. Existing deny-by-default client Firestore/Storage rules were not changed. Walk-in signed uploads require the existing approved private-document storage capability to be enabled in the target environment; this task did not enable production flags.

Dependency manifests and lockfiles are unchanged. Generated graph artifacts, test logs, media and fixture data are excluded from local commits. The repository-required graph update ran locally; its unrelated Swift parsing advisory does not concern application source.

## Exact source/test files and adjacent-change reasons

### Frontend

| File | Reason |
|---|---|
| `src/App.jsx` | Staff walk-in route using existing protected layouts. |
| `src/components/OfficialPlantingPhotos.jsx` | Shared evidence controls, real camera/EXIF verification, barangay boundaries and stale-release protection. |
| `src/components/PlantingPhotoControls.jsx` | Shared accessible Take Photo / Upload Existing Photos presentation. |
| `src/components/PurposePolicyFields.jsx` | Shared Staff proposal and Admin final policy inputs. |
| `src/components/PurposePolicySettings.jsx` | Versioned Admin policy editor; nullable unapproved thresholds and procedures. |
| `src/components/ReportingCoveragePanel.jsx` | Distinct distributed/reported/confirmed/leftover/future quantities. |
| `src/components/SamplingPolicyReadiness.jsx` | Show pending decisions, due dates, interval and Admin sampling validity attestation. |
| `src/components/StaffPlantingReportForm.jsx` | Stable photos/map/remarks/attendance order and clear authoritative missing-data state. |
| `src/components/WalkInScheduleAcknowledgement.jsx` | Original encoder records signed citizen schedule acknowledgement without citizen login. |
| `src/data/requestWorkflow.json` | Mirrored versioned sector and shared-purpose contract; no corporate purpose invented. |
| `src/pages/DashboardPage.jsx` | Add separate reporting coverage without changing official KPI calculations. |
| `src/pages/MyRequestsPage.jsx` | Display the approved reporting requirement separately from monitoring. |
| `src/pages/ParticipantSaplingRequestWizard.jsx` | Requesting As school split, shared purposes, citizen walk-in encoding, signed acknowledgement and correction validation. |
| `src/pages/PermanentSampleAnalyticsPage.jsx` | Display qualified sample estimates and unavailable reasons. |
| `src/pages/PlantingPage.jsx` | Backward-compatible final/partial confirmation, shared photo controls, stable section order and explicit quantity labels. |
| `src/pages/SeedlingRequestsPage.jsx` | Walk-in management, signed acknowledgement retrieval/schedules, Staff policy proposal and current-version Admin policy decision. |
| `src/pages/SettingsPage.jsx` | Mount Admin-only versioned purpose policy settings. |
| `src/pages/VerifiedPlantingCohortsPage.jsx` | New-policy sampling target/readiness and explicit Admin validity attestation; preserve legacy workflow. |
| `src/styles/official-planting.css` | Transparent native dialog surface and consistent dimmed backdrop. |
| `src/utils/plantingReportForm.js` | Validate final derived planted quantity and retain partial validation. |
| `src/utils/reportingCoverage.js` | Exclude optional/exempt requests and keep missing verification unknown. |
| `src/utils/requestLetterDownload.js` | Reuse authenticated blob download for private signed acknowledgements. |
| `src/utils/saplingRequestWorkflow.js` | Shared classification/purpose contract with legacy compatibility. |
| `tests/e2e/phase3c-real.spec.js` | Deterministic bounded cold-navigation discovery synchronization; real Auth/API/camera retained. |
| `tests/e2e/seedling-request-wizard.spec.js` | Focused acceptance/regression coverage for the coordinated contract and isolation safeguards. |
| `tests/e2e/workflow-forms.spec.js` | Focused acceptance/regression coverage for the coordinated contract and isolation safeguards. |
| `tests/reportingCoverage.test.js` | Focused acceptance/regression coverage for the coordinated contract and isolation safeguards. |
| `tests/requestLetterDownload.test.js` | Focused acceptance/regression coverage for the coordinated contract and isolation safeguards. |
| `tests/saplingRequestWorkflow.test.js` | Focused acceptance/regression coverage for the coordinated contract and isolation safeguards. |

### Backend

| File | Reason |
|---|---|
| `src/app.js` | Mount authenticated purpose-policy API. |
| `src/controller/plantingReport.controller.js` | Forward final/partial mode and leftovers to the authoritative report service. |
| `src/controller/seedlingRequest.controller.js` | Server-derived classification/identity, Staff policy proposal, Admin decision and walk-in correction context. |
| `src/controller/verifiedPlantingCohort.controller.js` | Forward explicit Admin estimate-validity approval. |
| `src/controller/walkInRequest.controller.js` | Verified Staff encoder boundary, actual citizen identity, signed private documents and account-free schedule recording. |
| `src/data/requestWorkflow.json` | Mirrored versioned sector and shared-purpose contract; no corporate purpose invented. |
| `src/routes/purposePolicy.routes.js` | Real authentication and Admin-only policy configuration. |
| `src/routes/seedlingRequest.routes.js` | Protected walk-in multipart submission, correction, signed schedule and private acknowledgement routes. |
| `src/services/distribution.service.js` | Resolve reporting policy from actual released quantities. |
| `src/services/earlyMonitoringNotification.service.js` | Exclude only new purpose-policy reports from legacy requester reminders. |
| `src/services/monitoring.service.js` | Exclude only new purpose-policy reports from requester aggregate assignments/submissions; preserve historical behavior. |
| `src/services/officialMonitoringNotification.service.js` | Exclude only new purpose-policy reports from legacy aggregate reminders. |
| `src/services/officialPlantingReport.service.js` | Preserve explicit historical classification, normalize authoritative coordinates, carry new policy and avoid duplicate monitoring schemes. |
| `src/services/parentPlantingReport.service.js` | Carry release policy and preserve final-leftover balance semantics; no new-policy requester early tasks. |
| `src/services/permanentSampleAnalytics.service.js` | Add separately qualified estimates while retaining existing sample and official KPI calculations. |
| `src/services/plantingReport.service.js` | Final balance transaction check, immutable partial accounting, new-policy coexistence and Firestore reads before cohort approval writes. |
| `src/services/purposePolicy.service.js` | Validated/effective versioned policy, immutable approval snapshots and gated sampling readiness. |
| `src/services/seedlingRequest.service.js` | Private walk-in/audit/acknowledgement linkage, policy approval snapshots, actual release status and independent versioned scheduling. |
| `src/services/verifiedPlantingCohort.service.js` | New-cohort policy snapshots, one capped target, species/site integrity, pending procedure gates and auditable Admin validity approval. |
| `src/utils/permanentSampleEstimate.util.js` | Complete resolved approved-tree estimates only with matching approved policy version. |
| `src/utils/requestClassification.util.js` | Authoritative classification independent of purpose; ambiguous legacy school records require explicit classification. |
| `tests/connectedWorkflow.test.js` | Focused acceptance/regression coverage for the coordinated contract and isolation safeguards. |
| `tests/coordinatedWorkflowPolicy.test.js` | Focused acceptance/regression coverage for the coordinated contract and isolation safeguards. |
| `tests/helpers/emulatorCreatedResources.js` | Test-only opt-in ownership cleanup for new workflow children/private documents and isolated counters. |
| `tests/integration/coordinatedRequestFixtureEmulator.test.js` | Focused acceptance/regression coverage for the coordinated contract and isolation safeguards. |
| `tests/monitoringNotification.test.js` | Focused acceptance/regression coverage for the coordinated contract and isolation safeguards. |
| `tests/permanentSampleEstimate.test.js` | Focused acceptance/regression coverage for the coordinated contract and isolation safeguards. |
| `tests/staffSeedlingRequest.test.js` | Focused acceptance/regression coverage for the coordinated contract and isolation safeguards. |
| `tests/verifiedPlantingCohort.test.js` | Focused acceptance/regression coverage for the coordinated contract and isolation safeguards. |
