# Staff seedling request local acceptance

Date: 2026-11-05. Scope: authenticated Staff requesting for themselves through the existing Participant wizard and authoritative request service. No on-behalf submission, production access, deployment, dependency or configuration change.

## Behavior and authorization

- Staff Requests exposes **Submit Seedling Request** and **My Requests**. Protected routes are `/staff/request-seedlings` and `/staff/my-requests`.
- Both roles use `ParticipantSaplingRequestWizard` and `MyRequestsPage`. All four steps, existing/proposed sites, optional proposed hectares, conditional exact area, map coordinates, document capabilities, identification validation and final confirmation remain shared.
- UID, requester name and contact come from verified backend identity. Staff individual requests can have no organization; group and Participant organization requirements remain unchanged. Staff role is recorded in submission, revision and requester schedule audit entries.
- Staff submissions start as `Pending` (displayed as Pending Review). A different Staff member reviews; Admin decides; a different Staff member releases. Owner identity is checked before processing writes, including approval after a requester becomes Admin. The same checks prevent self-return, rejection, coordination and late-release decisions. Existing role authorization remains active.
- Requester-only revision, coordinated-schedule confirmation and late-release proposal routes now permit Staff, retaining ownership and optimistic version validation. Staff requester notifications open My Requests; processing notifications still open the management queue. Review-task recipients exclude the requester.
- Inventory availability now permits authenticated Staff. Submission/review/approval do not deduct stock; release remains atomic and single-use. Request-linked calendar updates, notifications and the five-working-day advisory retain their existing implementation.
- Confirmed shared-form defect fixed: editing a returned request now hydrates the authoritative stored preferred release date instead of requiring the requester to re-enter it.

## Executed verification

| Check | Final result |
| --- | --- |
| New Staff request real Express/controller/service tests with memory Firestore and deterministic verified identities | 9/9 PASS |
| All credential-free backend suites, including request, inventory, lifecycle, security and schedule regressions | 792/792 PASS, 79 files |
| Frontend unit/safety suites | 202/202 PASS, 46 files |
| Complete workflow Playwright suite | 26/26 PASS: 17 existing plus 9 Staff/ownership/correction/route/schedule cases |
| Release modal, sidebar, topbar and responsive browser regressions | 12/12 PASS |
| Scoped ESLint on all changed JS/JSX | PASS |
| Production Vite build | PASS; existing bundle-size warning |
| Backend syntax checks, seven changed/new JS files | PASS |
| Both worktrees `git diff --check` | PASS |

Backend command for the focused suite: `node --require ./tests/testSetup.js --test --test-isolation=none tests/staffSeedlingRequest.test.js`.

Browser commands: `npx playwright test tests/e2e/workflow-forms.spec.js --config playwright.workflow.config.js --reporter=list` and `npx playwright test --config playwright.ui-a11y.config.js --reporter=list`.

Repository-wide `npm run lint`: **FAIL, unchanged baseline exception**. `src/pages/VerifiedPlantingCohortsPage.jsx` has `react-hooks/set-state-in-effect` errors at 48:34 and 52:5, and `react-hooks/exhaustive-deps` warning at 57:6 for `selected`. Its Git blob is `0af80901a3f9722055ce3f457de5a8e34e619e09`, identical to base `97087c9`. That page and lint configuration were not modified or suppressed.

The first backend aggregate had a no-result timeout in `sampleMonitoringEvidence.routes.test.js`; its isolated rerun passed 5/5, and the final complete backend rerun passed all 792 tests. Initial browser correction failures led to the release-date hydration fix; the complete post-fix workflow aggregate passed 26/26.

## Coverage limits and isolation

Browser tests use the real App, role guards, request wizard, owner page and management UI with the existing isolated Auth/API mocks. Backend tests use real Express routing, role middleware, controller, service transactions, notifications, calendar and inventory logic, replacing verified identity and Firestore at their boundaries. This is deterministic local acceptance, not a new Firebase Emulator or production E2E claim.

Backend assertions cover spoofed requester identity, unauthorized roles, owner processing denial without writes, owner-only listing/revisions, stale revision rejection, idempotent submission, independent review/approval/release, release duplicate protection, schedule confirmation and late-release calendar updates. Browser assertions cover keyboard-accessible Staff entry, read-only identity, form validation/submission, hidden owner processing controls, independent officer controls, Staff and Participant returned correction, protected routes and owner schedule confirmation.

Browser external requests are blocked by the existing localhost harness. Backend unit runs use the offline network guard and in-memory fixtures. HTTP listeners and Playwright-owned Vite servers closed after execution; no Firebase Emulator data was seeded, accessed or cleared. Generated graph artifacts remain excluded. Package manifests and lockfiles are unchanged.

## Reviewed files

Frontend:

- `src/App.jsx`
- `src/pages/SeedlingRequestsPage.jsx`
- `src/pages/ParticipantSaplingRequestWizard.jsx`
- `src/pages/MyRequestsPage.jsx`
- `src/styles/seedling-requests.css`
- `src/utils/requestOwnership.js`
- `src/utils/notificationRoutes.js`
- `tests/e2e/workflow-forms.spec.js`
- `tests/notificationRoutes.test.js`
- `docs/staff-seedling-request-acceptance.md`

Backend:

- `src/controller/seedlingRequest.controller.js`
- `src/routes/seedlingRequest.routes.js`
- `src/routes/inventory.routes.js`
- `src/services/seedlingRequest.service.js`
- `src/utils/requestSeparation.util.js`
- `tests/seedlingRequest.support.test.js`
- `tests/staffSeedlingRequest.test.js`

Local recommendation: GO for synchronization of the existing feature branches, with the documented unchanged repository-wide lint exception. No push, merge, deployment or production activation is included.
