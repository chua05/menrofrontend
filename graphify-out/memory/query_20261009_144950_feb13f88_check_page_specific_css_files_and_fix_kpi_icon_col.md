---
type: "query"
date: "2026-10-09T14:49:50.638831+00:00"
question: "Check page-specific CSS files and fix KPI icon colors across all MENRO pages"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Kpi()", "KpiCard()", "SeedlingRequestsPage.jsx", "SeedlingsPage.jsx", "EventSchedulePage.jsx", "ReforestationAnalyticsPage.jsx"]
---

# Q: Check page-specific CSS files and fix KPI icon colors across all MENRO pages

## Answer

Expanded query used KPI, statistic, summary, card, icon, CSS, dashboard, analytics, seedlings, requests, sites, events, monitoring, users, participant. The graph and source audit found page-specific KPI systems in Dashboard, Reforestation Analytics, Event Schedule, Inventory, Sapling Requests, User Management, Survival Monitoring, Participant My Requests, Map Visualization, and Planting Reports. Compound variant selectors had higher specificity than later base green rules. Each page-specific variant now directly resolves to background #e8f6ed and color #168a45; Planting Reports was added to coverage and its KPI icon container made circular.

## Outcome

- Signal: useful

## Source Nodes

- Kpi()
- KpiCard()
- SeedlingRequestsPage.jsx
- SeedlingsPage.jsx
- EventSchedulePage.jsx
- ReforestationAnalyticsPage.jsx