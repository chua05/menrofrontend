# MENRO system diagrams

Design diagrams for the Web-Based Geo-Tagged Reforestation Monitoring System (MENRO Bulan, Sorsogon). Open any `.drawio` file in [draw.io](https://app.diagrams.net), the draw.io desktop app, or the Draw.io Integration extension for VS Code. Every file can be edited directly.

| File | Diagram | What it shows |
|---|---|---|
| `01-dfd-level-0.drawio` | DFD Level 0 (context) | The whole system as one process, and the data each user and outside service exchanges with it |
| `02-dfd-level-1.drawio` | DFD Level 1 | The nine main processes, who uses each one, and the data stores each one reads and writes |
| `03-use-case.drawio` | Use case | What Participants, Guest Planters, MENRO Staff and Administrators can do |
| `04-erd.drawio` | Entity relationship | The main Firestore collections, their key fields, and how they relate |
| `05-activity-diagram.drawio` | Activity | The end-to-end flow from seedling request to survival monitoring, by role |

## Colour key

Colours mean the same thing in every diagram.

| Colour | People and services | Areas of the system (use case) |
|---|---|---|
| Blue | Participant | Seedling requests |
| Grey | Guest Planter | Shared use cases, notes |
| Teal | MENRO Staff | — |
| Orange | Administrator | Administrator-only use cases |
| Purple | External services (Firebase Authentication, Cloud Storage, OpenStreetMap) and the automatic System lane | Users and notifications |
| Green | MENRO processes (DFD) | Events and distribution |
| Yellow | Data stores (DFD), decisions (activity) | Inventory and planting sites |
| Brown | — | Planting reports and evidence |
| Red | Rejection path (activity) | Survival monitoring |

## Notation

- **DFD:** Gane and Sarson style. Rounded green boxes are processes, open-ended yellow boxes are data stores (D1 to D13), and square boxes are external entities. In Level 1, people and data stores are repeated on each row so that no data flows cross; processes share data only through the data stores.
- **Use case:** UML. The Administrator inherits every MENRO Staff use case (hollow arrow) and also has the Administrator-only group. Dashed arrows show «include» (the base use case always performs the included one; the arrow points from the base to the included use case) and «extend» (optional behaviour added to the base use case under a condition; the arrow points from the extension to the base). Supporting use cases sit in the middle column, level with their base use case.
- **ERD:** crow's-foot notation in plain table form: each entity lists its keys first (PK / FK column, bold and underlined), then its other fields, and every line is labelled 1, 0..1 or M at each end. Firestore is a document database, so a "FK" field stores another document's ID. References to the person who acted (`createdBy`, `actorId`, `authenticatedSubmitterUid`) and the capture session's `siteId` are listed as fields rather than drawn as lines. Technical collections (image hashes, quotas, counters, audit logs and upload intents) are left out.
- **Activity:** UML swimlanes. Each column is the role that performs the step, and decisions are diamonds with Yes / No branches.

## Sources

Built from the code on 2026-11-08 (frontend `92766d2`, backend `73e4112`):

- **Roles and features:** the routes in `src/App.jsx` and the role menus in `src/layouts/Sidebar.jsx`.
- **Collections and fields:** the Firestore services and controllers in `menroBK/src`.
- **External services:** Firebase Authentication and Cloud Storage (`menroBK/src/config`), and OpenStreetMap tiles (`src/components/PlantingLocationMap.jsx`).
- **Workflow and rules:** the request, schedule and approval steps; release and inventory handling; planting evidence checks (GPS accuracy of 50 m or better, timestamp and site radius); and survival monitoring.

If the system changes (a new role, collection or workflow step), update the matching diagram so they stay accurate.
