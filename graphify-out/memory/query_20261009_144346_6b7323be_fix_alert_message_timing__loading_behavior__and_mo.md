---
type: "query"
date: "2026-10-09T14:43:46.987477+00:00"
question: "Fix alert message timing, loading behavior, and modal overlay across MENRO system"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ToastProvider()", "SeedlingRequestsPage()", "useToast()"]
---

# Q: Fix alert message timing, loading behavior, and modal overlay across MENRO system

## Answer

Expanded from original query via vocab: toast, provider, modal, request, release, refresh, loading, success, apiRequest. ToastProvider is the shared portal; SeedlingRequestsPage caused the race by showing success before an unawaited blocking loadRequests refresh. The fix awaits background refresh, rebinds selected request state, waits for UI paint, then publishes the toast; ToastProvider starts its timer only when visible and toast.css layers it above existing overlays.

## Outcome

- Signal: useful

## Source Nodes

- ToastProvider()
- SeedlingRequestsPage()
- useToast()