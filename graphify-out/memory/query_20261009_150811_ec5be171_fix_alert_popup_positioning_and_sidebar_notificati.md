---
type: "query"
date: "2026-10-09T15:08:11.843162+00:00"
question: "Fix alert popup positioning and sidebar notification badge color consistency"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ToastProvider()", "Sidebar()", "Topbar()", "SeedlingRequestsPage.jsx", "EventSchedulePage.jsx", "MonitoringPage.jsx"]
---

# Q: Fix alert popup positioning and sidebar notification badge color consistency

## Answer

The shared toast was fixed at a viewport coordinate, so it could overlay modal subtitles and page headings. ToastProvider now selects the last active modal alert anchor, otherwise the dashboard page anchor, otherwise the viewport fallback. Request, Event, and Monitoring detail surfaces provide flow-positioned anchors between header and scrollable body; dashboard pages provide an empty-until-used region below the topbar. Sidebar used one red inactive badge rule and white/green active rule, causing role-visible inconsistency; the shared base badge now uses the existing white background and green text.

## Outcome

- Signal: useful

## Source Nodes

- ToastProvider()
- Sidebar()
- Topbar()
- SeedlingRequestsPage.jsx
- EventSchedulePage.jsx
- MonitoringPage.jsx