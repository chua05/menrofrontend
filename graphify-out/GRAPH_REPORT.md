# Graph Report - menrosystem  (2026-09-27)

## Corpus Check
- 59 files · ~134,442 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .css 21, (none) 2, .geojson 1)

## Summary
- 715 nodes · 1374 edges · 46 communities (38 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `680168ba`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PlantingPage
- SitesPage.jsx
- SeedlingRequestsPage.jsx
- MonitoringPage.jsx
- DashboardPage.jsx
- EventSchedulePage.jsx
- dropdown-menu.jsx
- ReforestationAnalyticsPage.jsx
- MapVisualizationPage.jsx
- MyRequestsPage.jsx
- dependencies
- SeedlingsPage.jsx
- components.json
- package.json
- RegisterPage.jsx
- App.jsx
- SettingsPage.jsx
- UsersPage.jsx
- devDependencies
- GuestEventPage.jsx
- auth
- axios
- Topbar.jsx
- config.js
- eslint.config.js
- scripts
- vite.config.js
- useAuth
- react
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
- fill_test_cases.py
- LandingPage.jsx
- artifact.md
- lucide-react

## God Nodes (most connected - your core abstractions)
1. `PlantingPage()` - 60 edges
2. `useAuth()` - 39 edges
3. `MonitoringPage()` - 31 edges
4. `DashboardPage()` - 29 edges
5. `formatDisplayId()` - 29 edges
6. `SitesPage()` - 27 edges
7. `react` - 26 edges
8. `react-router-dom` - 25 edges
9. `MyRequestsPage()` - 24 edges
10. `MapVisualizationPage()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Sidebar()` --calls--> `useAuth()`  [EXTRACTED]
  src/layouts/Sidebar.jsx → src/context/AuthContext.jsx
- `Topbar()` --calls--> `useAuth()`  [EXTRACTED]
  src/layouts/Topbar.jsx → src/context/AuthContext.jsx
- `CompleteProfilePage()` --calls--> `useAuth()`  [EXTRACTED]
  src/pages/CompleteProfilePage.jsx → src/context/AuthContext.jsx
- `DashboardPage()` --calls--> `useAuth()`  [EXTRACTED]
  src/pages/DashboardPage.jsx → src/context/AuthContext.jsx
- `EventSchedulePage()` --calls--> `useAuth()`  [EXTRACTED]
  src/pages/EventSchedulePage.jsx → src/context/AuthContext.jsx

## Import Cycles
- None detected.

## Communities (46 total, 8 thin omitted)

### Community 0 - "PlantingPage"
Cohesion: 0.07
Nodes (60): calculateDistanceMeters(), displayReportStatus(), formatDate(), formatDateTime(), formatFileSize(), getCurrentUserIdentity(), getDistributionReference(), getEventDateValue() (+52 more)

### Community 1 - "SitesPage.jsx"
Cohesion: 0.08
Nodes (35): BARANGAYS, COVERAGE_RADIUS_PRESETS, formatDate(), formatNumber(), getConditionColor(), getCoverageRadiusMeters(), getInitialSiteForm(), getSiteForm() (+27 more)

### Community 2 - "SeedlingRequestsPage.jsx"
Cohesion: 0.09
Nodes (40): AdminDecisionModal(), apiRequest(), BARANGAYS, createRequestId(), formatDate(), formatLocalDateLabel(), formatTime(), getAuthToken() (+32 more)

### Community 3 - "MonitoringPage.jsx"
Cohesion: 0.10
Nodes (33): FormAlert(), apiRequest(), buildMediaUrl(), CONDITION_META, deriveCondition(), formatDate(), formatDateTime(), formatFileSize() (+25 more)

### Community 4 - "DashboardPage.jsx"
Cohesion: 0.10
Nodes (40): ACTIVITY_CHART_INITIAL_SIZE, addRecordAliases(), apiGet(), belongsToParticipant(), buildMonthlyActivity(), buildSurvivalByBarangay(), createRecentActivities(), DashboardPage() (+32 more)

### Community 5 - "EventSchedulePage.jsx"
Cohesion: 0.10
Nodes (32): BARANGAYS, EVENT_TYPES, EventForm(), EventSchedulePage(), apiRequest(), getAuthToken(), loadArchivedEvents(), loadEvents() (+24 more)

### Community 6 - "dropdown-menu.jsx"
Cohesion: 0.09
Nodes (6): ref_base_ui_react_button, ref_base_ui_react_menu, class-variance-authority, cn, Button(), buttonVariants

### Community 7 - "ReforestationAnalyticsPage.jsx"
Cohesion: 0.21
Nodes (9): recharts, CONDITION_COLORS, EMPTY_ANALYTICS, escapeCsv(), formatNumber(), Kpi(), ReforestationAnalyticsPage(), SPECIES_COLORS (+1 more)

### Community 8 - "MapVisualizationPage.jsx"
Cohesion: 0.18
Nodes (24): CONDITION_OPTIONS, formatNumber(), getConditionColor(), getLatestMonitoringCondition(), getMonitoringSiteId(), getMonitoringSiteName(), getMonitoringTotals(), getReportQuantity() (+16 more)

### Community 9 - "MyRequestsPage.jsx"
Cohesion: 0.13
Nodes (25): formatDate(), formatDateTime(), formatFullDateTime(), formatTime(), getBarangay(), getContactNumber(), getEventLocation(), getEventName() (+17 more)

### Community 10 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, axios, @base-ui/react, class-variance-authority, cn, crypto-js, dayjs, exifr (+17 more)

### Community 11 - "SeedlingsPage.jsx"
Cohesion: 0.20
Nodes (11): apiRequest(), formatDateTime(), formatNumber(), getAuthToken(), getInitialForm(), normalizeInventoryItem(), NURSERY_OPTIONS, SeedlingsPage() (+3 more)

### Community 12 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 13 - "package.json"
Cohesion: 0.09
Nodes (21): name, private, type, version, @base-ui/react, crypto-js, dayjs, eslint (+13 more)

### Community 14 - "RegisterPage.jsx"
Cohesion: 0.16
Nodes (13): ref_react_icons_fc, CompleteProfilePage(), fieldStyle(), formatAccountDate(), getInitialForm(), ProfilePage(), configuredApiUrl, localApiUrl (+5 more)

### Community 15 - "App.jsx"
Cohesion: 0.24
Nodes (9): ref_react_dom_client, ref_react_icons_fi, react-router-dom, App(), src_index, PrivacyPolicyPage(), TermsOfServicePage(), src_styles_auth (+1 more)

### Community 16 - "SettingsPage.jsx"
Cohesion: 0.29
Nodes (5): DEFAULT_SETTINGS, loadStoredSettings(), SAFE_CACHE_PREFIXES, SettingsPage(), src_styles_settings_page

### Community 17 - "UsersPage.jsx"
Cohesion: 0.19
Nodes (11): BARANGAYS, formatDateTime(), getInitials(), getRoleLabel(), normalizeRole(), normalizeStatus(), PAGE_SIZE_OPTIONS, ROLE_OPTIONS (+3 more)

### Community 18 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/node, @types/react (+3 more)

### Community 19 - "GuestEventPage.jsx"
Cohesion: 0.19
Nodes (11): exifr, leaflet, ref_leaflet_dist_leaflet_css, GuestEventPage(), guestFetch(), loadContributions(), refreshGuestData(), submitPlanting() (+3 more)

### Community 20 - "auth"
Cohesion: 0.32
Nodes (6): auth, formatDate(), getReportTypeLabel(), REPORT_TYPES, ReportsPage(), src_styles_reports

### Community 22 - "Topbar.jsx"
Cohesion: 0.22
Nodes (10): getDisplayName(), getInitials(), getRoleLabel(), getSearchPlaceholder(), SEARCH_ICONS, timestampText(), Topbar(), clearSearch() (+2 more)

### Community 23 - "config.js"
Cohesion: 0.18
Nodes (14): ref_firebase_app, ref_firebase_auth, firebaseConfig, googleProvider, missingFirebaseConfig, requiredFirebaseConfig, configuredApiUrl, getLoginErrorMessage() (+6 more)

### Community 24 - "eslint.config.js"
Cohesion: 0.33
Nodes (5): ref_eslint_config, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals

### Community 25 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 26 - "vite.config.js"
Cohesion: 0.40
Nodes (4): ref_node_url, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 27 - "useAuth"
Cohesion: 0.30
Nodes (8): AuthContext, AuthProvider(), useAuth(), ProtectedRoute(), GuestOnlyRoute(), RootRedirect(), useEffectiveAuth(), dashboardPathForRole()

### Community 28 - "react"
Cohesion: 0.27
Nodes (9): react, react-dom, DashboardLayout(), getFallbackName(), getInitials(), getRoleLabel(), NAVIGATION, Sidebar() (+1 more)

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

### Community 42 - "fill_test_cases.py"
Cohesion: 0.18
Nodes (9): copy, datetime, docx, docx_enum_table, docx_enum_text, docx_oxml, docx_oxml_ns, docx_shared (+1 more)

### Community 43 - "LandingPage.jsx"
Cohesion: 0.29
Nodes (7): src_assets_aboutsys, src_assets_headerimg, src_assets_menro_logo, LandingPage(), PROGRAM_ITEMS, scrollToSection(), src_styles_landing_page

### Community 45 - "lucide-react"
Cohesion: 0.38
Nodes (6): ref_data_dashboardmockdata, lucide-react, getConditionColor(), getUtilizationColor(), PlantingSitesMap(), sitePositions

## Knowledge Gaps
- **171 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+166 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 294 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PlantingPage()` connect `PlantingPage` to `useAuth`, `EventSchedulePage.jsx`, `App.jsx`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `useAuth` to `PlantingPage`, `SitesPage.jsx`, `SeedlingRequestsPage.jsx`, `MonitoringPage.jsx`, `DashboardPage.jsx`, `EventSchedulePage.jsx`, `ReforestationAnalyticsPage.jsx`, `SeedlingsPage.jsx`, `RegisterPage.jsx`, `SettingsPage.jsx`, `UsersPage.jsx`, `auth`, `Topbar.jsx`, `config.js`, `react`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `PlantingPage`, `SitesPage.jsx`, `SeedlingRequestsPage.jsx`, `MonitoringPage.jsx`, `DashboardPage.jsx`, `EventSchedulePage.jsx`, `ReforestationAnalyticsPage.jsx`, `MapVisualizationPage.jsx`, `MyRequestsPage.jsx`, `SeedlingsPage.jsx`, `package.json`, `RegisterPage.jsx`, `App.jsx`, `SettingsPage.jsx`, `UsersPage.jsx`, `GuestEventPage.jsx`, `auth`, `Topbar.jsx`, `config.js`, `useAuth`, `LandingPage.jsx`, `lucide-react`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _171 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PlantingPage` be split into smaller, more focused modules?**
  _Cohesion score 0.07211538461538461 - nodes in this community are weakly interconnected._
- **Should `SitesPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07610993657505286 - nodes in this community are weakly interconnected._
- **Should `SeedlingRequestsPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09082125603864734 - nodes in this community are weakly interconnected._