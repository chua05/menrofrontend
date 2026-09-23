# Graph Report - menrosystem  (2026-09-22)

## Corpus Check
- 52 files · ~92,977 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 23 file(s) not represented in the graph (top: .css 20, (none) 2, .geojson 1)

## Summary
- 661 nodes · 1179 edges · 42 communities (35 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `22bcbe87`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PlantingPage
- SitesPage.jsx
- SeedlingRequestsPage.jsx
- MonitoringPage
- DashboardPage.jsx
- EventSchedulePage.jsx
- dropdown-menu.jsx
- ReforestationAnalyticsPage.jsx
- MapVisualizationPage.jsx
- MyRequestsPage.jsx
- dependencies
- UsersPage.jsx
- components.json
- package.json
- SeedlingsPage.jsx
- App.jsx
- useAuth
- devDependencies
- LoginPage.jsx
- Sidebar.jsx
- ProfilePage.jsx
- Topbar.jsx
- ReportsPage.jsx
- GuestEventPage.jsx
- eslint.config.js
- react
- scripts
- vite.config.js
- axios
- compilerOptions
- vercel.json
- What You Must Do When Invoked
- graphify reference: extra exports and benchmark
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- React + Vite
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- AGENTS.md
- extraction-spec.md

## God Nodes (most connected - your core abstractions)
1. `PlantingPage()` - 47 edges
2. `useAuth()` - 33 edges
3. `MonitoringPage()` - 29 edges
4. `SitesPage()` - 25 edges
5. `react` - 24 edges
6. `DashboardPage()` - 24 edges
7. `MapVisualizationPage()` - 23 edges
8. `MyRequestsPage()` - 22 edges
9. `ReforestationAnalyticsPage()` - 22 edges
10. `EventSchedulePage()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Sidebar()` --calls--> `useAuth()`  [EXTRACTED]
  src/layouts/Sidebar.jsx → src/context/AuthContext.jsx
- `Topbar()` --calls--> `useAuth()`  [EXTRACTED]
  src/layouts/Topbar.jsx → src/context/AuthContext.jsx
- `DashboardPage()` --calls--> `useAuth()`  [EXTRACTED]
  src/pages/DashboardPage.jsx → src/context/AuthContext.jsx
- `EventSchedulePage()` --calls--> `useAuth()`  [EXTRACTED]
  src/pages/EventSchedulePage.jsx → src/context/AuthContext.jsx
- `LoginPage()` --calls--> `useAuth()`  [EXTRACTED]
  src/pages/LoginPage.jsx → src/context/AuthContext.jsx

## Import Cycles
- None detected.

## Communities (42 total, 7 thin omitted)

### Community 0 - "PlantingPage"
Cohesion: 0.08
Nodes (48): calculateDistanceMeters(), displayReportStatus(), formatDate(), formatDateTime(), formatFileSize(), getCurrentUserIdentity(), getEventId(), getEventName() (+40 more)

### Community 1 - "SitesPage.jsx"
Cohesion: 0.07
Nodes (35): leaflet, ref_leaflet_dist_leaflet_css, BARANGAYS, formatDate(), formatNumber(), getConditionColor(), getInitialSiteForm(), getSiteStatus() (+27 more)

### Community 2 - "SeedlingRequestsPage.jsx"
Cohesion: 0.09
Nodes (36): ADMIN_REJECTION_REASONS, AdminDecisionModal(), apiRequest(), BARANGAYS, createRequestId(), formatDate(), formatLocalDateLabel(), formatTime() (+28 more)

### Community 3 - "MonitoringPage"
Cohesion: 0.10
Nodes (31): recharts, apiRequest(), buildMediaUrl(), CONDITION_META, deriveCondition(), formatDate(), formatDateTime(), formatFileSize() (+23 more)

### Community 4 - "DashboardPage.jsx"
Cohesion: 0.12
Nodes (32): apiGet(), BARANGAYS, belongsToParticipant(), buildMonthlyActivity(), buildSurvivalByBarangay(), createRecentActivities(), DashboardPage(), DashboardSitesMap() (+24 more)

### Community 5 - "EventSchedulePage.jsx"
Cohesion: 0.10
Nodes (28): BARANGAYS, EVENT_TYPES, EventForm(), EventSchedulePage(), apiRequest(), getAuthToken(), loadArchivedEvents(), loadEvents() (+20 more)

### Community 6 - "dropdown-menu.jsx"
Cohesion: 0.07
Nodes (12): ref_base_ui_react_button, ref_base_ui_react_menu, class-variance-authority, cn, ref_data_dashboardmockdata, lucide-react, getConditionColor(), getUtilizationColor() (+4 more)

### Community 7 - "ReforestationAnalyticsPage.jsx"
Cohesion: 0.14
Nodes (27): CONDITION_COLORS, escapeCsv(), formatMonth(), formatNumber(), getMonitoringBarangay(), getMonitoringDate(), getMonitoringSiteId(), getMonitoringSiteName() (+19 more)

### Community 8 - "MapVisualizationPage.jsx"
Cohesion: 0.15
Nodes (27): CONDITION_OPTIONS, formatNumber(), getConditionColor(), getLatestMonitoringCondition(), getMonitoringSiteId(), getMonitoringSiteName(), getMonitoringTotals(), getReportQuantity() (+19 more)

### Community 9 - "MyRequestsPage.jsx"
Cohesion: 0.14
Nodes (23): formatDate(), formatDateTime(), formatTime(), getBarangay(), getContactNumber(), getEventLocation(), getEventName(), getExpectedParticipants() (+15 more)

### Community 10 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, axios, @base-ui/react, class-variance-authority, cn, crypto-js, dayjs, exifr (+17 more)

### Community 11 - "UsersPage.jsx"
Cohesion: 0.12
Nodes (17): ref_firebase_app, ref_firebase_auth, firebaseConfig, googleProvider, missingFirebaseConfig, requiredFirebaseConfig, BARANGAYS, formatDateTime() (+9 more)

### Community 12 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 13 - "package.json"
Cohesion: 0.09
Nodes (22): name, private, type, version, @base-ui/react, crypto-js, dayjs, eslint (+14 more)

### Community 14 - "SeedlingsPage.jsx"
Cohesion: 0.20
Nodes (11): apiRequest(), formatDateTime(), formatNumber(), getAuthToken(), getInitialForm(), normalizeInventoryItem(), NURSERY_OPTIONS, SeedlingsPage() (+3 more)

### Community 15 - "App.jsx"
Cohesion: 0.22
Nodes (10): ref_react_icons_fc, ref_react_icons_fi, react-router-dom, PrivacyPolicyPage(), configuredApiUrl, localApiUrl, RegisterPage(), TermsOfServicePage() (+2 more)

### Community 16 - "useAuth"
Cohesion: 0.20
Nodes (9): AuthContext, AuthProvider(), useAuth(), DEFAULT_SETTINGS, loadStoredSettings(), SAFE_CACHE_PREFIXES, SettingsPage(), ProtectedRoute() (+1 more)

### Community 17 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/node, @types/react (+3 more)

### Community 18 - "LoginPage.jsx"
Cohesion: 0.27
Nodes (9): auth, configuredApiUrl, localApiUrl, LoginPage(), GuestOnlyRoute(), RootRedirect(), useEffectiveAuth(), src_styles_login (+1 more)

### Community 19 - "Sidebar.jsx"
Cohesion: 0.29
Nodes (8): react-dom, DashboardLayout(), getFallbackName(), getInitials(), getRoleLabel(), NAVIGATION, Sidebar(), src_styles_dashboard_shell

### Community 20 - "ProfilePage.jsx"
Cohesion: 0.31
Nodes (5): BARANGAYS, fieldStyle(), formatAccountDate(), getInitialForm(), ProfilePage()

### Community 21 - "Topbar.jsx"
Cohesion: 0.39
Nodes (5): getDisplayName(), getInitials(), getRoleLabel(), getSearchPlaceholder(), Topbar()

### Community 22 - "ReportsPage.jsx"
Cohesion: 0.32
Nodes (6): formatDate(), getReportTypeLabel(), REPORT_TYPES, reports, ReportsPage(), src_styles_reports

### Community 23 - "GuestEventPage.jsx"
Cohesion: 0.29
Nodes (3): src_assets_menro_logo, GuestEventPage(), src_styles_guest_event

### Community 24 - "eslint.config.js"
Cohesion: 0.33
Nodes (5): ref_eslint_config, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals

### Community 25 - "react"
Cohesion: 0.33
Nodes (5): react, ref_react_dom_client, App(), src_index, src_styles_auth

### Community 26 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 27 - "vite.config.js"
Cohesion: 0.40
Nodes (4): ref_node_url, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 31 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 32 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 33 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 34 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 35 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 36 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 37 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + Vite

## Knowledge Gaps
- **172 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+167 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 282 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `PlantingPage`, `SitesPage.jsx`, `SeedlingRequestsPage.jsx`, `MonitoringPage`, `DashboardPage.jsx`, `EventSchedulePage.jsx`, `dropdown-menu.jsx`, `ReforestationAnalyticsPage.jsx`, `MapVisualizationPage.jsx`, `MyRequestsPage.jsx`, `UsersPage.jsx`, `package.json`, `SeedlingsPage.jsx`, `App.jsx`, `useAuth`, `LoginPage.jsx`, `Sidebar.jsx`, `ProfilePage.jsx`, `Topbar.jsx`, `ReportsPage.jsx`, `GuestEventPage.jsx`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `useAuth` to `PlantingPage`, `SitesPage.jsx`, `SeedlingRequestsPage.jsx`, `MonitoringPage`, `DashboardPage.jsx`, `EventSchedulePage.jsx`, `UsersPage.jsx`, `SeedlingsPage.jsx`, `LoginPage.jsx`, `Sidebar.jsx`, `ProfilePage.jsx`, `Topbar.jsx`, `ReportsPage.jsx`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `PlantingPage()` connect `PlantingPage` to `useAuth`, `App.jsx`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _172 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PlantingPage` be split into smaller, more focused modules?**
  _Cohesion score 0.07896575821104122 - nodes in this community are weakly interconnected._
- **Should `SitesPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07188160676532769 - nodes in this community are weakly interconnected._
- **Should `SeedlingRequestsPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09407665505226481 - nodes in this community are weakly interconnected._