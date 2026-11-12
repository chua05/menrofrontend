# Permanent Sample Monitoring Physical Device Acceptance

Status: NOT EXECUTED. Local Chromium fake video/geolocation is not physical-device acceptance.

## Preconditions

- Use disposable demo fixtures and an isolated backend/Auth/Firestore/private Storage environment only.
- Establish an approved device-reachable HTTPS test origin or verified loopback forwarding. Every API/Firebase endpoint must still resolve to the intended isolated emulator service; device localhost is not the desktop localhost without forwarding. Stop if that cannot be verified.
- Record Android/iOS version, device model, browser version, origin, test project, fixture ID and date. Do not record real passwords, capture nonces/tokens or private object paths in the acceptance report.
- Test at least Android Chrome and iPhone Safari for the declared supported device/browser range. Test additional embedded browsers only if they are within the supported release scope.
- Use a real authorized Staff fixture and an Admin fixture with two authoritative permanent Tree IDs. Use known authorized fixture site/tree coordinates and actual device location; never override reported GPS to obtain a pass.

## Minimum test matrix

| Scenario | Android Chrome | iPhone Safari | Required result/evidence |
| --- | --- | --- | --- |
| Camera and location allow/deny/re-enable | Pending | Pending | Clear error; no stuck action; retry works after permission change; permission request follows user interaction. |
| Precise location off, unavailable, poor indoor fix, outdoor fix | Pending | Pending | Missing/nonfinite or greater-than-50 m accuracy never passes; acquisition progress and bounded timeout remain accurate. A 92 m reading is rejected even if its point lies within the site. |
| Camera preview and lenses | Pending | Pending | Usable rear-camera preview, nonzero frame dimensions, permitted switching, correct portrait/landscape presentation and actual JPEG preview. |
| Movement between preview and capture | Pending | Pending | A fresh capture fix is acquired; the preview-opening fix is not silently reused. |
| Retake, cancel, close/reopen, tree navigation | Pending | Pending | Camera tracks stop; selected tree/photo/error stay isolated; unsaved assessments/questions survive navigation and canceled reload. |
| Site and municipality boundary cases | Pending | Pending | Valid configured-site point succeeds; outside assigned radius/polygon and municipality fail with the correct tree-level message. Accuracy and boundary are separate requirements. |
| Original device photographs and EXIF | Pending | Pending | Inspect untouched geotagged JPEG, location-disabled original, stripped-metadata copy and HEIC/file-conversion behavior. Missing GPS/accuracy stays unavailable, never zero or current-device replacement. Normal permanent-sample original uploads remain disabled. A separate guarded local proposal has synthetic/emulator acceptance only; genuine Android/iOS original-photo acceptance and formal MENRO approval remain pending. |
| Session expiry and device clock | Pending | Pending | Five-minute expiry and invalid timestamps produce safe errors and require an appropriate fresh capture; no fabricated timestamps or tokens. |
| Interrupted verification/upload | Pending | Pending | Test offline/interrupted connection and background/resume. Busy states resolve, entries are retained, and exact retry/reconciliation does not duplicate evidence. |
| Two-tree private evidence/maps | Pending | Pending | Distinct previews, registered-tree/site/evidence markers, actual coordinates, separate linkage and protected retrieval; no public Storage URL. |
| Draft and full review lifecycle | Pending | Pending | Save/reopen, submit, Admin Return, correction/new evidence revision, resubmit and approve; original evidence remains retrievable and Approved is read-only. |
| Responsive and assistive interaction | Pending | Pending | No overlap/overflow; usable keyboard/focus/labels, touch controls, map zoom and screen-reader errors. Include narrow widths and orientation changes. |

## Policy-dependent cases

Do not mark original-file admission, mandatory current-revision photos, Not Located/Needs Rechecking evidence completeness or automatic future scheduling as passing before their MENRO rules are approved and the corresponding backend enforcement exists. Historical photos are not automatically proof of the current revision.

## Sign-off

For each case, record PASS/FAIL/BLOCKED, device/browser details, sanitized screenshot or network result, actual location/accuracy where authorized, backend result and cleanup verification. Device testing must not alter shared datasets or production settings. A simulated or desktop-only result cannot replace either platform's pending physical result.
