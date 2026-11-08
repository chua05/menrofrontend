# Login startup recovery: local acceptance
Date: 2026-11-08 (Asia/Manila).
Status: LOCAL GO for the verified recovery changes, uncommitted. The reported device-specific deployed failure is NOT reproduced or declared fixed in production.

## Read-only deployed findings
The user-confirmed https://menro-xxtt-five.vercel.app/ and /login both returned HTTP 200 and rendered their expected landing/login content in a clean Chromium context. No uncaught application runtime errors were observed. The deployed login loaded assets/index-C_xuSZuk.js. The login response supplied no Content-Security-Policy header in that check. Browser Firebase/backend/external requests were blocked; no production sign-in or data mutation was performed.
Reported contentscript.js MaxListenersExceededWarning/orphaned stream messages are not application-source messages. CSP-eval and Fenced Frame issues were not established as a cause of the failure. No unsafe-eval permission or CSP weakening was added. The existing Vercel SPA rewrite and normal Vite configuration remain unchanged. The service worker source has no fetch/cache interception handler.

## Confirmed blank-screen paths and local fixes
- GuestOnlyRoute, RootRedirect and ProtectedRoute returned null while authentication was loading. A delayed session restore could therefore show an empty page without a runtime exception. They now display an accessible pending-auth view and same-page reload link; user/role/session decisions and fail-closed behavior remain unchanged. The public / route remains LandingPage.
- App/Firebase were statically imported before React mounted. An environment/bootstrap/module-load exception escaped before any error boundary existed. A small guarded dynamic bootstrap now catches app initialization/chunk failures and renders a safe DOM fallback.
- A root React error boundary renders safe recovery content on component/effect render failures.
- Initial HTML contains readable loading/reload instructions plus a noscript explanation, so a missing/blocked entry script does not leave an empty root.
- The local feature worktree lacks Firebase build-time variables. A normal build succeeds, but runtime initialization correctly fails without them; the new error screen was verified. This is not evidence of missing Vercel variables because the current deployed login renders. No environment variables or authentication validation were relaxed.

## Executed verification
- Existing Admin/Staff/Participant email and Google fixture login, redirects, logout, session/deep-link regressions: 6/6 PASS.
- Pending auth at login/register/protected route, import failure, render failure, healthy mount, real missing-Firebase-config initialization, no-JavaScript recovery, compiled fixture healthy login and blocked app chunk: 10/10 PASS in the final affected run.
- Frontend unit/safety suite: 210/210 PASS.
- Scoped and repository ESLint PASS. Initial test-fixture refresh lint was fixed without disabling rules.
- Normal Vite production build PASS with existing large-chunk advisory.
- git diff --check PASS.
Initial incorrect assertions treated / as a guarded route and relied on noscript visibility through a Playwright text locator; these were corrected to match the public route and actual readable recovery link. A compiled healthy test initially used the intentionally unconfigured ordinary local build; its actual missing-config failure was diagnosed, not hidden. The healthy compiled test now uses existing test-only Auth/API aliases in a separate TEMP build; real missing-config coverage remains separate.

## Scope and isolation
Production source: index.html, src/main.jsx, src/bootstrap.js, src/renderApp.jsx, src/components/AppErrorBoundary.jsx, src/components/AuthLoading.jsx, src/styles/startup.css, src/routes/RootRedirect.jsx, src/routes/ProtectedRoute.jsx.
Tests: tests/bootstrap.test.js, tests/e2e/startup-fallback.spec.js, tests/e2e/login-corrections.spec.js, tests/login/AuthContext.js, tests/startup/index.html, tests/startup/entry.jsx, vite.startup-test.config.js.
AuthProvider, Firebase configuration, LoginPage authentication logic, normal Vite/Vercel configuration, dependencies, backend, production settings and feature gates are unchanged.
Local servers used 127.0.0.1:5184/5187/5188/5189; external browser requests were blocked. No real users or Firebase database records were changed. TEMP/menro-login-startup-20261108 contains local runner artifacts and mobile login/error screenshots.
No commit, push, merge or deployment performed. Existing graph artifacts and ignored fixtures preserved. Physical-device/current-profile reproduction is still needed to distinguish pending Auth, blocked/stale assets, storage restrictions and extension interference for the original incident.

## Main-only release candidate
Built from origin/main 03f03ec18443e717473a2dadc395ebe97d9c20a3 without merging feature history. Only the 17 listed startup/login files were transferred; existing planting/GPS/workflow changes in main remain untouched. Candidate acceptance: 250/250 unit/safety tests, 16/16 browser tests, repository ESLint, normal Vite build and diff checks PASS. Build retains the existing large-chunk advisory. Production configuration, AuthProvider, Firebase setup, dependencies and backend are unchanged. The user separately authorized a normal main push and deployment verification after these checks. Earlier no-push statements record the pre-release checkpoint.
