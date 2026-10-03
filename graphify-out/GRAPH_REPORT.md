# Graph Report - menrosystem  (2026-10-04)

## Corpus Check
- 164 files · ~190,732 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 30 file(s) not represented in the graph (top: .css 23, (none) 4, .resolved 1)

## Summary
- 1665 nodes · 2482 edges · 121 communities (107 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `951c7f69`
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
- MapVisualizationPage.jsx
- MyRequestsPage.jsx
- dependencies
- SeedlingsPage.jsx
- components.json
- package.json
- RegisterPage.jsx
- Sidebar.jsx
- ReforestationAnalyticsPage.jsx
- App Hosting CLI Commands
- devDependencies
- Deterministic Rules for Migration
- Mutations
- Key Attributes
- react
- SettingsPage.jsx
- Configuration Reference
- scripts
- vite.config.js
- CEL Expressions
- eslint.config.js
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
- @check and @redact
- artifact.md
- Security Reference
- Firebase Crashlytics - Android Setup Guide (Kotlin)
- Firebase Remote Config - Android Setup Guide (Kotlin)
- Native SQL Examples
- firebase-basics/SKILL.md
- 1. Vector Similarity Search (Semantic)
- Firestore Web SDK Usage Guide
- Advanced Validation for Business Logic
- Firebase Authentication Web SDK
- ⛔️ CRITICAL RULE: NO INLINE INITIALIZATION ⛔️
- Firestore Indexes Reference
- ⛔️ CRITICAL RULES & ENVIRONMENT CHECKS
- Step-by-Step Migration Execution
- Firebase Android Setup Guide
- main.jsx
- Schema Reference
- Web SDK
- Firebase SQL Connect
- Writing Data
- Cloud Functions Integration Reference
- 1. Local Prototyping: Data Seeding
- Templates
- Firebase Authentication - Android Setup Guide (Kotlin)
- Flutter & Firebase Setup Guide
- Realtime Reference
- Firebase SQL Connect - Android Setup Guide (Kotlin)
- Flutter SDK
- iOS SDK
- Cloud Firestore (Enterprise edition) - Android Setup Guide (Kotlin)
- Cloud Firestore (Standard edition) - Android Setup Guide (Kotlin)
- Firebase AI Logic Basics
- ⛔️ CRITICAL RULE: NO INLINE INITIALIZATION ⛔️
- main.swift
- Admin Node SDK
- Firebase Functions V1 vs V2 Signature Mapping
- ⛔️ CRITICAL RULE: NO INLINE INITIALIZATION ⛔️
- Native SQL Operations
- Document Data Model
- Firestore Indexes Reference
- Web SDK Usage (Enterprise Native Mode)
- Firebase AI Logic iOS Setup Guide
- Firebase AI Logic on Android (Kotlin)
- firebase-auth-basics/SKILL.md
- Firebase Auth & Google Sign-In for Flutter
- Basic Checks
- Alternative: Manual MCP Configuration (Project Scope)
- Manual Initialization
- Flutter Setup for Firebase AI Logic
- Firebase AI Logic Basics
- Core Capabilities
- authenticatedApi.js
- Cloud Firestore in Flutter
- Cloud Firestore in Flutter
- Manual Initialization
- 1. Instance Selection and Edition Detection
- Assessment: Security Validator (Red Team Edition)
- button.jsx
- App Check Debug Tokens for Local Development & CI/CD
- Workflow
- Firebase Local Environment Setup
- Recommended: Global Setup
- Recommended: Global Setup
- Firebase Web Setup Guide
- lucide-react
- Antigravity Setup
- Recommended Method: Using Plugins
- Cursor Setup
- authService.js
- Android Studio Setup
- Package.swift
- config.js
- App.jsx
- .audit-temp/artifact.md
- useAuth

## God Nodes (most connected - your core abstractions)
1. `PlantingPage()` - 68 edges
2. `useAuth()` - 39 edges
3. `SitesPage()` - 32 edges
4. `react` - 29 edges
5. `DashboardPage()` - 29 edges
6. `MonitoringPage()` - 29 edges
7. `formatDisplayId()` - 29 edges
8. `react-router-dom` - 26 edges
9. `MapVisualizationPage()` - 24 edges
10. `MyRequestsPage()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `3. Initialization` --references--> `App()`  [INFERRED]
  .agents/skills/firebase-basics/references/ios_setup.md → src/App.jsx
- `⛔️ CRITICAL RULE: INITIALIZATION ORDER ⛔️` --references--> `App()`  [INFERRED]
  .agents/skills/firebase-basics/references/ios_setup.md → src/App.jsx
- `AuthProvider()` --calls--> `verifyMenroSession()`  [EXTRACTED]
  src/context/AuthContext.jsx → src/services/authenticatedApi.js
- `Sidebar()` --calls--> `useAuth()`  [EXTRACTED]
  src/layouts/Sidebar.jsx → src/context/AuthContext.jsx
- `Topbar()` --calls--> `useAuth()`  [EXTRACTED]
  src/layouts/Topbar.jsx → src/context/AuthContext.jsx

## Import Cycles
- None detected.

## Communities (121 total, 14 thin omitted)

### Community 0 - "PlantingPage"
Cohesion: 0.06
Nodes (71): calculateDistanceMeters(), canRenderImage(), displayReportStatus(), formatDate(), formatDateTime(), formatFileSize(), getCurrentUserIdentity(), getDistributionReference() (+63 more)

### Community 1 - "SitesPage.jsx"
Cohesion: 0.08
Nodes (35): BARANGAYS, COVERAGE_RADIUS_PRESETS, formatDate(), formatNumber(), getConditionColor(), getCoverageRadiusMeters(), getInitialSiteForm(), getSiteForm() (+27 more)

### Community 2 - "SeedlingRequestsPage.jsx"
Cohesion: 0.08
Nodes (43): AdminDecisionModal(), apiRequest(), BARANGAYS, createRequestId(), formatDate(), formatLocalDateLabel(), formatTime(), getAuthToken() (+35 more)

### Community 3 - "MonitoringPage.jsx"
Cohesion: 0.09
Nodes (36): FormAlert(), authenticatedImageRequest(), messages, ProtectedEvidenceImage(), load(), apiRequest(), CONDITION_META, deriveCondition() (+28 more)

### Community 4 - "DashboardPage.jsx"
Cohesion: 0.10
Nodes (40): ACTIVITY_CHART_INITIAL_SIZE, addRecordAliases(), apiGet(), belongsToParticipant(), buildMonthlyActivity(), buildSurvivalByBarangay(), createRecentActivities(), DashboardPage() (+32 more)

### Community 5 - "EventSchedulePage.jsx"
Cohesion: 0.06
Nodes (47): ref_node_test, BARANGAYS, EVENT_TYPES, EventForm(), EventSchedulePage(), apiRequest(), getAuthToken(), loadEvents() (+39 more)

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
Nodes (13): apiRequest(), formatDateTime(), formatNumber(), getAuthToken(), getInitialForm(), normalizeDistribution(), normalizeInventoryItem(), NURSERY_OPTIONS (+5 more)

### Community 12 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 13 - "package.json"
Cohesion: 0.09
Nodes (21): name, private, type, version, @base-ui/react, crypto-js, dayjs, eslint (+13 more)

### Community 14 - "RegisterPage.jsx"
Cohesion: 0.21
Nodes (12): src_assets_menro_logo, CompleteProfilePage(), fieldStyle(), formatAccountDate(), getInitialForm(), ProfilePage(), RegisterPage(), publicApiFetch() (+4 more)

### Community 15 - "Sidebar.jsx"
Cohesion: 0.23
Nodes (12): ref_node_assert_strict, react-dom, getFallbackName(), getInitials(), getRoleLabel(), NAVIGATION, Sidebar(), authenticatedFetch() (+4 more)

### Community 16 - "ReforestationAnalyticsPage.jsx"
Cohesion: 0.08
Nodes (25): exifr, leaflet, ref_leaflet_dist_leaflet_css, recharts, AnalyticsSitesMap(), conditionColor(), FALLBACK_CENTER, utilization() (+17 more)

### Community 17 - "App Hosting CLI Commands"
Cohesion: 0.06
Nodes (30): App Hosting CLI Commands, Automated deployment via GitHub (CI/CD), Backend Management, Initialization, `npx -y firebase-tools@latest apphosting:backends:create`, `npx -y firebase-tools@latest apphosting:backends:delete <backend-id>`, `npx -y firebase-tools@latest apphosting:backends:get <backend-id>`, `npx -y firebase-tools@latest apphosting:backends:list` (+22 more)

### Community 18 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/node, @types/react (+3 more)

### Community 19 - "Deterministic Rules for Migration"
Cohesion: 0.07
Nodes (27): 1. Per-Function Configuration, 2. Global Configuration (`setGlobalOptions`), 3. Migrating Environment Configurations (`functions.config()`), Advanced Interpolation & Logic, Built-ins, Common Property Translations, Deterministic Rules for Migration, Initialization & Scope (+19 more)

### Community 20 - "Mutations"
Cohesion: 0.07
Nodes (26): Aliases, Basic Query, Contents, Create, Create with Server Values, Delete, Embedded Queries, Expression Operators (Compare with Server Values) (+18 more)

### Community 21 - "Key Attributes"
Cohesion: 0.08
Nodes (23): `cleanUrls` (Optional), Full Example, `headers` (Optional), Hosting Configuration (`firebase.json`), `ignore` (Optional), Key Attributes, `public` (Required), `redirects` (Optional) (+15 more)

### Community 22 - "react"
Cohesion: 0.18
Nodes (16): react, DashboardLayout(), getDisplayName(), getInitials(), getRoleLabel(), getSearchPlaceholder(), SEARCH_ICONS, timestampText() (+8 more)

### Community 23 - "SettingsPage.jsx"
Cohesion: 0.32
Nodes (5): DEFAULT_SETTINGS, loadStoredSettings(), SAFE_CACHE_PREFIXES, SettingsPage(), src_styles_settings_page

### Community 24 - "Configuration Reference"
Cohesion: 0.08
Nodes (24): Breaking Changes, CI/CD Integration, Cloud SQL Configuration, Configuration Reference, Connect from SDK, connector.yaml, Contents, dataconnect.yaml (+16 more)

### Community 25 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 26 - "vite.config.js"
Cohesion: 0.40
Nodes (4): ref_node_url, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 27 - "CEL Expressions"
Cohesion: 0.40
Nodes (5): auth.token Fields, Available Bindings, CEL Expressions, Expression Examples, Using eq_expr in Filters

### Community 28 - "eslint.config.js"
Cohesion: 0.33
Nodes (5): ref_eslint_config, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals

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
Cohesion: 0.20
Nodes (9): copy, datetime, docx, docx_enum_table, docx_enum_text, docx_oxml, docx_oxml_ns, docx_shared (+1 more)

### Community 43 - "@check and @redact"
Cohesion: 0.40
Nodes (5): Authorization Data Lookup, @check, @check and @redact, @redact, Validate Key Exists

### Community 45 - "Security Reference"
Cohesion: 0.13
Nodes (14): Access Levels, Anti-Patterns, @auth Directive, Authorization Patterns, Contents, ❌ Don't Pass User ID as Variable, ❌ Don't Trust Unverified Email, ❌ Don't Use PUBLIC/USER for Prototyping (+6 more)

### Community 46 - "Firebase Crashlytics - Android Setup Guide (Kotlin)"
Cohesion: 0.08
Nodes (21): 1. Add dependencies to Gradle build files, 2. *Optional:* Install the NDK SDK to capture native crashes, 3. *Required:* Force a test crash, Add custom debugging information, Firebase Crashlytics - Android Setup Guide (Kotlin), Module (app-level) `build.gradle.kts` (`<project>/<app-module>/build.gradle.kts`), Optional additional steps, Prerequisites (+13 more)

### Community 47 - "Firebase Remote Config - Android Setup Guide (Kotlin)"
Cohesion: 0.08
Nodes (21): 1. Add dependencies to Gradle build files, 2. Set in-app defaults, 3. Fetch and activate values, Firebase Remote Config - Android Setup Guide (Kotlin), Prerequisites, Add Swift Package Dependencies, Fetch and Activate Values, Firebase Remote Config iOS Setup Guide (+13 more)

### Community 48 - "Native SQL Examples"
Cohesion: 0.10
Nodes (20): Advanced aggregation with RANK, Advanced CTE with upserts (atomic get-or-create), Basic SELECT with field aliasing, Basic UPDATE, Blog with Permissions, E-Commerce Store, Examples, Movie Review App (+12 more)

### Community 49 - "firebase-basics/SKILL.md"
Cohesion: 0.11
Nodes (11): Exploring Commands, Initialization, Refresh Android Studio Local Environment, Refresh Antigravity Local Environment, Refresh Claude Code Local Environment, Refresh Gemini CLI Local Environment, Refresh Other Local Environment, Common Issues (+3 more)

### Community 50 - "1. Vector Similarity Search (Semantic)"
Cohesion: 0.11
Nodes (17): 1. Query Formats (`queryFormat` argument), 1. Vector Similarity Search (Semantic), 2. Full-Text Search (Lexical), 2. Relevance Thresholding (`relevanceThreshold` and `_metadata.relevance`), A. Auto-Embedding Search, A. Generation on Insert, Automatic Embedding Generation (`_embed` server value), B. Custom Vector Search (+9 more)

### Community 51 - "Firestore Web SDK Usage Guide"
Cohesion: 0.12
Nodes (16): Add a Document with Auto-ID (`addDoc`), Firestore Web SDK Usage Guide, Get a Single Document (`getDoc`), Get Multiple Documents (`getDocs`), Handle Changes (Added/Modified/Removed), Initialization, Listen to a Document/Query (`onSnapshot`), Order and Limit (+8 more)

### Community 52 - "Advanced Validation for Business Logic"
Cohesion: 0.12
Nodes (16): 1. Enforce Enum Values, 2. Validate State Transitions, 3. Strict Path and Relationship Scoping, 4. Secure Counter Updates, 5. **CRITICAL** Ensure Application Validity, Advanced Validation for Business Logic, Critical Constraints, Critical Directives for Secure Generation (+8 more)

### Community 53 - "Firebase Authentication Web SDK"
Cohesion: 0.13
Nodes (15): Connect to Emulator, Email Link Authentication, Firebase Authentication Web SDK, Initialization, Observe Auth State, Sign In Anonymously, Sign In with Apple (Popup), Sign In with Facebook (Popup) (+7 more)

### Community 54 - "⛔️ CRITICAL RULE: NO INLINE INITIALIZATION ⛔️"
Cohesion: 0.13
Nodes (14): 1. Import and Initialize, 2. Type-Safe Data Models (Codable), 3. Basic CRUD Operations, 4. Pipeline Queries, 5. Realtime Listeners in SwiftUI (Lifecycle Best Practices), ⛔️ CRITICAL RULE: NO FirebaseFirestoreSwift ⛔️, ⛔️ CRITICAL RULE: NO INLINE INITIALIZATION ⛔️, Examples (+6 more)

### Community 55 - "Firestore Indexes Reference"
Cohesion: 0.13
Nodes (15): 1. High Write Rates (Sequential Values), 2. Large String/Map/Array Fields, 3. TTL Fields, Automatic vs. Manual Management, Best Practices & Exemptions, CLI Commands, Composite Indexes, Config files (+7 more)

### Community 56 - "⛔️ CRITICAL RULES & ENVIRONMENT CHECKS"
Cohesion: 0.13
Nodes (14): 1. The Anti-Ruby Mandate, 2. Modern Xcode Folder Synchronization, 3. Allowed Scripting Languages, 4. Toolchain Verification, 5. Mandatory Linker Flags for Static Frameworks (Firebase), **CRITICAL: Always Use Latest SDK Version**, ⛔️ CRITICAL RULES & ENVIRONMENT CHECKS, Empty Directory Workflow (+6 more)

### Community 57 - "Step-by-Step Migration Execution"
Cohesion: 0.14
Nodes (13): 1. Declarative IAM & APIs (Zero-Local-Overhead), 2. Global Parameter Access Restriction, 3. V2 Concurrency & Cost Parity, Core Rules & Constraints, Extension to Functions Codebase & npm Package Migration, Overview, Step 1: Inventory Extension Resources, Step 2: Configure `package.json` (+5 more)

### Community 58 - "Firebase Android Setup Guide"
Cohesion: 0.14
Nodes (13): 1. Check if the Android project is connected to a Firebase Project, 2. Create a new Firebase project or use an existing one, 3. Register the Android project, 4. Obtain and save `google-services.json`, 5. Add the `google-services` plugin, Firebase Android Setup Guide, `google-services.json` file is NOT present, `google-services.json` file is present (+5 more)

### Community 59 - "main.jsx"
Cohesion: 0.14
Nodes (13): 1. Create a Firebase Project and App (Automated), 2. Installation (Automated via Swift Package Manager CLI), 3. Initialization, AppDelegate (Traditional / UIKit), ⛔️ CRITICAL RULE: INITIALIZATION ORDER ⛔️, ⛔️ CRITICAL RULE: STATE MANAGEMENT (OBSERVATION VS COMBINE) ⛔️, Firebase iOS Setup Guide, SwiftUI (Modern - SAFE PATTERN) (+5 more)

### Community 60 - "Schema Reference"
Cohesion: 0.10
Nodes (20): @col, Contents, Core Directives, Customizing Tables, Data Types, @default, Defining Types, Enumerations (+12 more)

### Community 61 - "Web SDK"
Cohesion: 0.14
Nodes (14): Best Practices for Agents, Calling Operations, Client-Side Caching, Data Type Mapping Reference, Initialization, Installation, Resilient Enum Handling, Subscriptions (Realtime) (+6 more)

### Community 62 - "Firebase SQL Connect"
Cohesion: 0.14
Nodes (14): 1. Define Data Model (`schema/schema.gql`), 2. Define Authorized Operations (`connector/queries.gql`, `connector/mutations.gql`), 3. Use type-safe SDK in your apps, Deployment & CLI, Development Workflow, Examples, Feature Capability Map, Firebase SQL Connect (+6 more)

### Community 63 - "Writing Data"
Cohesion: 0.14
Nodes (13): Add a Document with Auto-ID, Get a Single Document, Get Multiple Documents, Order and Limit, Pipeline Queries, Python SDK Usage, Queries, Reading Data (+5 more)

### Community 64 - "Cloud Functions Integration Reference"
Cohesion: 0.15
Nodes (12): Accessing User Authentication Context, Auth Context Mappings, Auth Extraction Example, Cloud Functions Integration Reference, Comprehensive Example, Core Trigger Configuration, 🚨 Critical Infinite Loop Constraint, Event Filtering (+4 more)

### Community 65 - "1. Local Prototyping: Data Seeding"
Cohesion: 0.15
Nodes (12): 1. Local Prototyping: Data Seeding, 2. Production: Admin SDK Bulk Operations, 3. Production: Bulk Operations via raw SQL, 🚨 Critical SQL Operations Constraint, Data Seeding & Bulk Operations Reference, Resetting Seed Data, SDK Bulk APIs Features:, SDK Bulk Operations Example (+4 more)

### Community 66 - "Templates"
Cohesion: 0.15
Nodes (12): Basic CRUD Schema, Client Subscribe (Web), connector.yaml Template, dataconnect.yaml Template, Event-Driven Refresh, Firebase Init Commands, Many-to-Many Relationship, Realtime Query Templates (+4 more)

### Community 67 - "Firebase Authentication - Android Setup Guide (Kotlin)"
Cohesion: 0.17
Nodes (12): 1. Enable Authentication via CLI, 2. Add dependencies to Gradle build files, 3. Initialize FirebaseAuth, 4. Check current Auth state, 5. Use sign-in providers in the app, 6. Sign out users, Email/Password, Firebase Authentication - Android Setup Guide (Kotlin) (+4 more)

### Community 68 - "Flutter & Firebase Setup Guide"
Cohesion: 0.17
Nodes (11): 1. Re-running `flutterfire configure` Upon Renaming, 2. Platform-Specific Build Requirements, 3. Web CORS Best Practices, 4. Elaborating on `WidgetsFlutterBinding.ensureInitialized()`, Flutter & Firebase Setup Guide, Prerequisites, Step 1: Create a Flutter Project, Step 2: Configure Firebase (+3 more)

### Community 69 - "Realtime Reference"
Cohesion: 0.17
Nodes (12): CEL Bindings in Conditions, Combining Multiple @refresh Directives, Common Patterns, Contents, Explicit Mutation Signals (`onMutationExecuted`), Implicit Entity Refresh signals, `mutation` — The Triggering Event, Realtime Reference (+4 more)

### Community 70 - "Firebase SQL Connect - Android Setup Guide (Kotlin)"
Cohesion: 0.17
Nodes (12): 1. Add dependencies to Gradle build files, 2. Initialize, 3. Work with SQL Connect, Basic query, Best practices for agents working with Firebase SQL Connect, Calling operations, Client-side caching, Data type mapping reference (+4 more)

### Community 71 - "Flutter SDK"
Cohesion: 0.17
Nodes (12): Basic Query, Best Practices for Agents, Calling Operations, Client-Side Caching, Data Type Mapping Reference, Flutter SDK, Imports, Initialization (+4 more)

### Community 72 - "iOS SDK"
Cohesion: 0.17
Nodes (12): Basic Query, Best Practices for Agents, Calling Operations, Client-Side Caching, Data Type Mapping Reference, Dependencies (Package.swift or SPM), Initialization, iOS SDK (+4 more)

### Community 73 - "Cloud Firestore (Enterprise edition) - Android Setup Guide (Kotlin)"
Cohesion: 0.17
Nodes (11): 1. Provision Firestore, 2. Add dependencies to Gradle build files, 3. Initialize Firestore, 4. Decision framework: Mandatory pipeline architecture, 5. Pipeline examples, 6. Real-time listener & document operations, Cloud Firestore (Enterprise edition) - Android Setup Guide (Kotlin), Full-text search (+3 more)

### Community 74 - "Cloud Firestore (Standard edition) - Android Setup Guide (Kotlin)"
Cohesion: 0.17
Nodes (11): 1. Provision Firestore, 2. Add dependencies to Gradle build files, 3. Initialize Firestore, 4. Work with data, Add data, Cloud Firestore (Standard edition) - Android Setup Guide (Kotlin), Delete data, Jetpack Compose (Modern) (+3 more)

### Community 75 - "Firebase AI Logic Basics"
Cohesion: 0.18
Nodes (11): Advanced Features, Firebase AI Logic Basics, Initialization Code References, Installation, On-Device AI (Hybrid), Overview, Prerequisites, References (+3 more)

### Community 76 - "⛔️ CRITICAL RULE: NO INLINE INITIALIZATION ⛔️"
Cohesion: 0.18
Nodes (10): 1. Import and Initialize, 2. Type-Safe Data Models (Codable), 3. Writing Data (Modern Concurrency & Codable), 4. Reading Data (Modern Concurrency & Codable), 5. Realtime Listeners in SwiftUI (Lifecycle Best Practices), ⛔️ CRITICAL RULE: NO FirebaseFirestoreSwift ⛔️, ⛔️ CRITICAL RULE: NO INLINE INITIALIZATION ⛔️, Firebase Firestore iOS Setup Guide (+2 more)

### Community 77 - "main.swift"
Cohesion: 0.33
Nodes (10): addCrashlyticsRunScriptBuildPhase(), hasCrashlyticsRunScriptBuildPhase(), isUserScriptSandboxingEnabled(), main(), setDwarfWithDsymDebugInformationFormat(), Bool, Foundation, PathKit (+2 more)

### Community 78 - "Admin Node SDK"
Cohesion: 0.20
Nodes (9): 1. Impersonating an Unauthenticated User, 2. Impersonating a Specific User (Cloud Functions), 3. Impersonating a Specific User (Plain HTTP), 4. Running with Unrestricted Access, Admin Node SDK, Best Practices for Agents, Configuration in `connector.yaml`, Generation (+1 more)

### Community 79 - "Firebase Functions V1 vs V2 Signature Mapping"
Cohesion: 0.22
Nodes (8): Auth (Blocking), Cloud Firestore, Cloud Pub/Sub, Cloud Storage, Cloud Tasks, Firebase Functions V1 vs V2 Signature Mapping, HTTP / Callables, Realtime Database

### Community 80 - "⛔️ CRITICAL RULE: NO INLINE INITIALIZATION ⛔️"
Cohesion: 0.22
Nodes (8): 1. Import and Initialize, 2. Authentication State, 3. Email and Password Authentication (Modern Concurrency), 4. Sign Out, ⛔️ CRITICAL RULE: NO INLINE INITIALIZATION ⛔️, Firebase Auth iOS Setup Guide, Sign In, Sign Up

### Community 81 - "Native SQL Operations"
Cohesion: 0.22
Nodes (8): Core Agent Constraints, Mutation Fields (DML), Native SQL Operations, Native SQL Root Fields, PostgreSQL Extensions, Query Fields (Read-Only), ⚠️ Security: Stored Procedures & Dynamic SQL, Syntax rules & limitations

### Community 82 - "Document Data Model"
Cohesion: 0.22
Nodes (8): Collection Group Support, Collections, Document Data Model, Documents, Examples, Firestore Data Model Reference, Subcollections, Use Cases

### Community 83 - "Firestore Indexes Reference"
Cohesion: 0.22
Nodes (9): CLI Commands, Config files, Firestore Indexes Reference, Index Density, Index Ordering, Index Structure, Management, Query Support Examples (+1 more)

### Community 84 - "Web SDK Usage (Enterprise Native Mode)"
Cohesion: 0.22
Nodes (8): 1. Initialization, 2. Decision Framework: Pipelines vs. Standard Queries, 3. Pipeline Examples, 4. Real-Time Listener & Document Operations, Full-Text Search, Relational Joins Pattern, Rules & Accountability, Web SDK Usage (Enterprise Native Mode)

### Community 85 - "Firebase AI Logic iOS Setup Guide"
Cohesion: 0.25
Nodes (7): 1. Import and Initialize, 2. SwiftUI Integration (Best Practices), 3. Safety Settings, Advanced Features, Chat Session (Multi-turn), Firebase AI Logic iOS Setup Guide, Function Calling (Tools)

### Community 86 - "Firebase AI Logic on Android (Kotlin)"
Cohesion: 0.25
Nodes (8): 0. Enable Firebase AI Logic via CLI, 1. Add Dependencies, 2. Initialize and Generate Content, 3. Multimodal Input (Text and Images), 4. Chat Session (Multi-turn), 5. Streaming Responses, Firebase AI Logic on Android (Kotlin), Jetpack Compose (Modern)

### Community 87 - "firebase-auth-basics/SKILL.md"
Cohesion: 0.25
Nodes (5): Core Concepts, Identity Providers, Prerequisites, Tokens, Users

### Community 88 - "Firebase Auth & Google Sign-In for Flutter"
Cohesion: 0.25
Nodes (7): 1. `google_sign_in` 7.2.0 API Changes, 2. Initialization & Web Hang/Crash Pitfalls, 3. Web Logout Crashes, 4. Prototyping Workaround: Bypassing Firestore Composite Indices, 5. Robust `AuthService` Boilerplate, 6. Troubleshooting `auth/unauthorized-domain` on Flutter Web, Firebase Auth & Google Sign-In for Flutter

### Community 89 - "Basic Checks"
Cohesion: 0.25
Nodes (7): Authentication in Security Rules, Basic Checks, Check if user is signed in, Check if user owns the data, Check if user owns the document (field-based), Example: Email Verification Check, Token Properties

### Community 90 - "Alternative: Manual MCP Configuration (Project Scope)"
Cohesion: 0.25
Nodes (7): 1. Configure and Verify Firebase MCP Server, 1. Install and Verify Firebase Extension, 2. Restart and Verify Connection, 2. Restart and Verify Connection, Alternative: Manual MCP Configuration (Project Scope), Gemini CLI Setup, Recommended: Installing Extensions

### Community 91 - "Manual Initialization"
Cohesion: 0.25
Nodes (8): 1. Create a Firestore Enterprise Database, 2. Create `firebase.json`, 2. Create `firestore.rules`, 3. Create `firestore.indexes.json`, Deploy rules and indexes, Local Emulation, Manual Initialization, Provisioning Firestore Enterprise Native Mode

### Community 92 - "Flutter Setup for Firebase AI Logic"
Cohesion: 0.29
Nodes (6): Chat Session, Flutter Setup for Firebase AI Logic, Initialization, Installation, Text Generation, Usage

### Community 93 - "Firebase AI Logic Basics"
Cohesion: 0.29
Nodes (7): Advanced Features, Chat Session (Multi-turn), Core Capabilities, Firebase AI Logic Basics, Initialization Pattern, Multimodal (Text + Images/Audio/Video/PDF input), Streaming Responses

### Community 94 - "Core Capabilities"
Cohesion: 0.29
Nodes (7): Chat Session (Multi-turn), Core Capabilities, Generate Images with Nano Banana, Multimodal (Text + Images/Audio/Video/PDF input), Search Grounding with the built in googleSearch tool, Streaming Responses, Text-Only Generation

### Community 95 - "authenticatedApi.js"
Cohesion: 0.36
Nodes (7): backendErrorCode(), configuredApiUrl, localApiUrl, MenroApiError, requestBackendSession(), verifyMenroSession(), wait()

### Community 96 - "Cloud Firestore in Flutter"
Cohesion: 0.29
Nodes (6): 1. Setup, 2. Best Practices: Type-Safe Models, 3. The Service Layer, 4. Listening to Streams in the UI (`StreamBuilder`), Cloud Firestore in Flutter, Initialization & References

### Community 97 - "Cloud Firestore in Flutter"
Cohesion: 0.29
Nodes (6): 1. Setup, 2. Best Practices: Type-Safe Models, 3. The Service Layer, 4. Listening to Streams in the UI (`StreamBuilder`), Cloud Firestore in Flutter, Initialization & References

### Community 98 - "Manual Initialization"
Cohesion: 0.29
Nodes (7): 1. Create `firebase.json`, 2. Create `firestore.rules`, 3. Create `firestore.indexes.json`, Deploy database, rules and indexes, Local Emulation, Manual Initialization, Provisioning Cloud Firestore

### Community 99 - "1. Instance Selection and Edition Detection"
Cohesion: 0.29
Nodes (7): 1. Instance Selection and Edition Detection, 2. Specialized Guides, A. Instance Found, B. No Instance Found (or New Requested), Cloud Firestore Database and Operations, Enterprise Edition / Native Mode (`references/enterprise/`), Standard Edition (`references/standard/`)

### Community 100 - "Assessment: Security Validator (Red Team Edition)"
Cohesion: 0.29
Nodes (6): Admin Bootstrapping & Privileges:, Assessment: Security Validator (Red Team Edition), Mandatory Audit Checklist:, Overview, Scoring Criteria, Scoring Criteria (1-5):

### Community 101 - "button.jsx"
Cohesion: 0.33
Nodes (5): ref_base_ui_react_button, class-variance-authority, cn, Button(), buttonVariants

### Community 102 - "App Check Debug Tokens for Local Development & CI/CD"
Cohesion: 0.33
Nodes (6): App Check, App Check Debug Tokens for Local Development & CI/CD, CI/CD Pipelines (Pre-Provisioned), Local Development (Auto-Generated), Remote Config, Security & Production

### Community 103 - "Workflow"
Cohesion: 0.33
Nodes (6): 1. Provisioning, 2. Client Setup & Usage, 3. Security Rules, Option 1. Enabling Authentication via CLI, Option 2. Enabling Authentication in Console, Workflow

### Community 104 - "Firebase Local Environment Setup"
Cohesion: 0.33
Nodes (5): 1. Verify Node.js, 2. Verify Firebase CLI, 3. Verify Firebase Authentication, 4. Install Agent Skills and MCP Server, Firebase Local Environment Setup

### Community 105 - "Recommended: Global Setup"
Cohesion: 0.33
Nodes (5): 1. Install and Verify Firebase Skills, 2. Configure and Verify Firebase MCP Server, 3. Restart and Verify Connection, GitHub Copilot Setup, Recommended: Global Setup

### Community 106 - "Recommended: Global Setup"
Cohesion: 0.33
Nodes (5): 1. Install and Verify Firebase Skills, 2. Configure and Verify Firebase MCP Server, 3. Restart and Verify Connection, Other Agents Setup, Recommended: Global Setup

### Community 107 - "Firebase Web Setup Guide"
Cohesion: 0.33
Nodes (5): 1. Create a Firebase Project and App, 2. Installation, 3. Initialization, 4. Using Services, Firebase Web Setup Guide

### Community 108 - "lucide-react"
Cohesion: 0.38
Nodes (6): ref_data_dashboardmockdata, lucide-react, getConditionColor(), getUtilizationColor(), PlantingSitesMap(), sitePositions

### Community 109 - "Antigravity Setup"
Cohesion: 0.40
Nodes (4): 1. Install and Verify Firebase Skills, 2. Configure and Verify Firebase MCP Server, 3. Restart and Verify Connection, Antigravity Setup

### Community 110 - "Recommended Method: Using Plugins"
Cohesion: 0.40
Nodes (4): 1. Install and Verify Plugins, 2. Restart and Verify Connection, Claude Code Setup, Recommended Method: Using Plugins

### Community 111 - "Cursor Setup"
Cohesion: 0.40
Nodes (4): 1. Install and Verify Firebase Skills, 2. Configure and Verify Firebase MCP Server, 3. Restart and Verify Connection, Cursor Setup

### Community 113 - "Android Studio Setup"
Cohesion: 0.50
Nodes (3): Android Studio Setup, MCP Setup, Skills Installation

### Community 116 - "config.js"
Cohesion: 0.14
Nodes (21): ref_firebase_app, ref_firebase_auth, ref_react_icons_fc, auth, firebaseConfig, googleProvider, missingFirebaseConfig, requiredFirebaseConfig (+13 more)

### Community 117 - "App.jsx"
Cohesion: 0.15
Nodes (17): ref_react_icons_fi, react-router-dom, src_assets_aboutsys, src_assets_headerimg, LandingPage(), PROGRAM_ITEMS, scrollToSection(), PrivacyPolicyPage() (+9 more)

### Community 119 - "useAuth"
Cohesion: 0.30
Nodes (10): AuthContext, AuthProvider(), useAuth(), ProtectedRoute(), GuestOnlyRoute(), RootRedirect(), useEffectiveAuth(), resetMenroSessionRequest() (+2 more)

## Knowledge Gaps
- **735 isolated node(s):** `PackageDescription`, `Foundation`, `PathKit`, `$schema`, `style` (+730 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 862 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App()` connect `main.jsx` to `App.jsx`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `PlantingPage()` connect `PlantingPage` to `EventSchedulePage.jsx`, `App.jsx`, `RegisterPage.jsx`, `useAuth`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `PackageDescription`, `Foundation`, `PathKit` to the rest of the system?**
  _735 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PlantingPage` be split into smaller, more focused modules?**
  _Cohesion score 0.06220095693779904 - nodes in this community are weakly interconnected._
- **Should `SitesPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0824524312896406 - nodes in this community are weakly interconnected._
- **Should `SeedlingRequestsPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08392156862745098 - nodes in this community are weakly interconnected._
- **Should `MonitoringPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08826945412311266 - nodes in this community are weakly interconnected._