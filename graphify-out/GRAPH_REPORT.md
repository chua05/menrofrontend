# Graph Report - menrosystem  (2026-09-24)

## Corpus Check
- 59 files · ~131,788 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .css 21, (none) 2, .geojson 1)

## Summary
- 700 nodes · 1339 edges · 45 communities (37 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dd45c6fb`
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
- ProfilePage.jsx
- App.jsx
- SettingsPage.jsx
- UsersPage.jsx
- devDependencies
- GuestEventPage.jsx
- RegisterPage.jsx
- axios
- lucide-react
- config.js
- eslint.config.js
- scripts
- vite.config.js
- LandingPage.jsx
- useAuth
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
- RootRedirect.jsx
- artifact.md

## God Nodes (most connected - your core abstractions)
1. `PlantingPage()` - 55 edges
2. `useAuth()` - 39 edges
3. `formatDisplayId()` - 32 edges
4. `MonitoringPage()` - 31 edges
5. `DashboardPage()` - 29 edges
6. `react` - 26 edges
7. `SitesPage()` - 26 edges
8. `MyRequestsPage()` - 24 edges
9. `MapVisualizationPage()` - 23 edges
10. `EventSchedulePage()` - 22 edges

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

## Communities (45 total, 8 thin omitted)

### Community 0 - "PlantingPage"
Cohesion: 0.08
Nodes (52): calculateDistanceMeters(), displayReportStatus(), formatDate(), formatDateTime(), formatFileSize(), getCurrentUserIdentity(), getEventDateValue(), getEventId() (+44 more)

### Community 1 - "SitesPage.jsx"
Cohesion: 0.08
Nodes (33): BARANGAYS, formatDate(), formatNumber(), getConditionColor(), getInitialSiteForm(), getSiteStatus(), getUtilization(), getUtilizationColor() (+25 more)

### Community 2 - "SeedlingRequestsPage.jsx"
Cohesion: 0.09
Nodes (39): AdminDecisionModal(), apiRequest(), BARANGAYS, createRequestId(), formatDate(), formatLocalDateLabel(), formatTime(), getAuthToken() (+31 more)

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
Cohesion: 0.18
Nodes (12): auth, apiRequest(), formatDateTime(), formatNumber(), getAuthToken(), getInitialForm(), normalizeInventoryItem(), NURSERY_OPTIONS (+4 more)

### Community 12 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 13 - "package.json"
Cohesion: 0.09
Nodes (21): name, private, type, version, @base-ui/react, crypto-js, dayjs, eslint (+13 more)

### Community 14 - "ProfilePage.jsx"
Cohesion: 0.36
Nodes (4): fieldStyle(), formatAccountDate(), getInitialForm(), ProfilePage()

### Community 15 - "App.jsx"
Cohesion: 0.22
Nodes (10): ref_react_dom_client, ref_react_icons_fi, react-router-dom, App(), AuthProvider(), src_index, PrivacyPolicyPage(), TermsOfServicePage() (+2 more)

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

### Community 20 - "RegisterPage.jsx"
Cohesion: 0.27
Nodes (8): CompleteProfilePage(), configuredApiUrl, localApiUrl, RegisterPage(), src_styles_register, JUBAN_BARANGAYS, USER_TYPES, userTypeField()

### Community 22 - "lucide-react"
Cohesion: 0.11
Nodes (19): ref_data_dashboardmockdata, lucide-react, react-dom, getConditionColor(), getUtilizationColor(), PlantingSitesMap(), sitePositions, DashboardLayout() (+11 more)

### Community 23 - "config.js"
Cohesion: 0.17
Nodes (15): ref_firebase_app, ref_firebase_auth, ref_react_icons_fc, firebaseConfig, googleProvider, missingFirebaseConfig, requiredFirebaseConfig, configuredApiUrl (+7 more)

### Community 24 - "eslint.config.js"
Cohesion: 0.33
Nodes (5): ref_eslint_config, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals

### Community 25 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 26 - "vite.config.js"
Cohesion: 0.40
Nodes (4): ref_node_url, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 27 - "LandingPage.jsx"
Cohesion: 0.29
Nodes (7): src_assets_aboutsys, src_assets_headerimg, src_assets_menro_logo, LandingPage(), PROGRAM_ITEMS, scrollToSection(), src_styles_landing_page

### Community 28 - "useAuth"
Cohesion: 0.24
Nodes (9): react, AuthContext, useAuth(), formatDate(), getReportTypeLabel(), REPORT_TYPES, ReportsPage(), ProtectedRoute() (+1 more)

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

### Community 43 - "RootRedirect.jsx"
Cohesion: 0.67
Nodes (4): GuestOnlyRoute(), RootRedirect(), useEffectiveAuth(), dashboardPathForRole()

## Knowledge Gaps
- **169 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+164 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 293 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `useAuth` to `PlantingPage`, `SitesPage.jsx`, `SeedlingRequestsPage.jsx`, `MonitoringPage.jsx`, `DashboardPage.jsx`, `EventSchedulePage.jsx`, `ReforestationAnalyticsPage.jsx`, `MapVisualizationPage.jsx`, `MyRequestsPage.jsx`, `SeedlingsPage.jsx`, `package.json`, `ProfilePage.jsx`, `App.jsx`, `SettingsPage.jsx`, `UsersPage.jsx`, `GuestEventPage.jsx`, `RegisterPage.jsx`, `lucide-react`, `config.js`, `LandingPage.jsx`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `PlantingPage()` connect `PlantingPage` to `useAuth`, `EventSchedulePage.jsx`, `App.jsx`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `useAuth` to `PlantingPage`, `SitesPage.jsx`, `SeedlingRequestsPage.jsx`, `MonitoringPage.jsx`, `DashboardPage.jsx`, `EventSchedulePage.jsx`, `ReforestationAnalyticsPage.jsx`, `SeedlingsPage.jsx`, `RootRedirect.jsx`, `ProfilePage.jsx`, `SettingsPage.jsx`, `UsersPage.jsx`, `RegisterPage.jsx`, `lucide-react`, `config.js`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _169 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PlantingPage` be split into smaller, more focused modules?**
  _Cohesion score 0.08045977011494253 - nodes in this community are weakly interconnected._
- **Should `SitesPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07665505226480836 - nodes in this community are weakly interconnected._
- **Should `SeedlingRequestsPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09191919191919191 - nodes in this community are weakly interconnected._