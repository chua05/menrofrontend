import test from "node:test";
import assert from "node:assert/strict";
import { definitions, expand, findAll, installJsxHarness, textOf } from "./helpers/jsxHarness.js";

const icons = ["Camera", "Image", "MapPin", "Trees", "ChevronLeft", "ChevronRight", "CircleCheck", "AlertTriangle", "Search", "Circle", "Lock"];
installJsxHarness({ modules: {
  "lucide-react": icons.map(name => `export const ${name} = () => null;`).join("\n"),
  "MonitoringInformationPanel": "export default function MonitoringInformationPanel() { return null; }",
  "permanentSampleFeatures": "export const informationEnabled = () => false;",
} });
const { default: PermanentSampleVisitForm, PermanentSampleVisitShell } = await import("../src/components/PermanentSampleVisitForm.jsx");
const { default: PlantingLocationMap } = await import("../src/components/PlantingLocationMap.jsx");
const keep = new Set([PlantingLocationMap]);

// A first-visit readiness row exactly as the backend returns it (D-5 contract), before any visit exists.
const site = { id: "site-1", siteName: "Bical Riverside", barangay: "Bical", latitude: 12.662301, longitude: 123.932983, coverageRadiusMeters: 50,
  polygon: [{ lat: 12.66, lng: 123.93 }, { lat: 12.67, lng: 123.93 }, { lat: 12.67, lng: 123.94 }], address: "Purok 3" };
const readinessRow = (context = {}) => ({ cohortId: "cohort-1", reportNumber: "PR-FV-1", siteName: "Bical Riverside", nextVisitNumber: 1,
  nextScheduledDueDate: "2026-11-24", scheduleStatus: "DUE", canCreateVisit: true, reasons: [{ code: "FIRST_VISIT_REGISTERS_BASELINE", sampleTarget: 3 }],
  context: { plantingReportId: "report-1", plantingReportNumber: "PR-FV-1", site, plantingDate: "2026-11-24", verificationStatus: "Approved",
    verifiedPlantedQuantity: 25, species: [{ species: "Narra", quantity: 25 }], sampleTarget: 3, sampleRegistrationStatus: "NOT_STARTED",
    registeredSampleCount: 0, nextVisitNumber: 1, monitoringStatus: "FIRST_VISIT_AVAILABLE", ...context } });

test("D-5: the pre-visit shell renders every Section 1 field from the readiness context with the spec labels", () => {
  const tree = expand(PermanentSampleVisitShell({ describedBy: "reason", report: readinessRow() }), keep);
  const rows = new Map(definitions(tree));
  assert.deepEqual([...rows.keys()].slice(0, 12), ["Planting Report ID", "Planting Site Name", "Barangay / Address", "Planting Date", "Verification Status",
    "Verified Planted Quantity", "Species and Quantities", "Automatic 10% Sample Target", "Sample Registration Status", "Registered Sample Tree Count",
    "Monitoring Visit Number", "Current Monitoring Status"]);
  assert.equal(rows.get("Planting Report ID"), "PR-FV-1");
  assert.equal(rows.get("Planting Site Name"), "Bical Riverside");
  assert.equal(rows.get("Barangay / Address"), "Bical · Purok 3");
  assert.equal(rows.get("Planting Date"), "2026-11-24");
  assert.equal(rows.get("Verification Status"), "Approved");
  assert.equal(rows.get("Verified Planted Quantity"), "25");
  assert.equal(rows.get("Species and Quantities"), "Narra: 25 planted");
  assert.equal(rows.get("Automatic 10% Sample Target"), "3");
  assert.equal(rows.get("Sample Registration Status"), "Not Started");
  assert.equal(rows.get("Registered Sample Tree Count"), "0");
  assert.equal(rows.get("Monitoring Visit Number"), "1");
  assert.equal(rows.get("Current Monitoring Status"), "First Visit Available");
  const text = textOf(tree);
  assert.doesNotMatch(text, /No permanent-sample cohort|NOT_STARTED|FIRST_VISIT_AVAILABLE/);
});

test("D-5: the map is initialised with the readiness site and its polygon", () => {
  const tree = expand(PermanentSampleVisitShell({ describedBy: "reason", report: readinessRow() }), keep);
  const [map] = findAll(tree, node => node.type === PlantingLocationMap);
  assert.ok(map, "a map is rendered before the visit exists");
  assert.equal(map.props.site, site);
  assert.equal(map.props.highlightSitePolygon, true);
});

test("D-5: DUE and NOT_STARTED statuses are readable labels", () => {
  const tree = expand(PermanentSampleVisitShell({ describedBy: "reason", report: readinessRow({ monitoringStatus: "DUE" }) }), keep);
  assert.equal(new Map(definitions(tree)).get("Current Monitoring Status"), "Due");
  const notStarted = expand(PermanentSampleVisitShell({ describedBy: "reason", report: readinessRow({ monitoringStatus: "NOT_STARTED" }) }), keep);
  assert.equal(new Map(definitions(notStarted)).get("Current Monitoring Status"), "Not Started");
});

test("D-5: shell measurement labels match the spec (Stem Diameter in millimetres)", () => {
  const tree = expand(PermanentSampleVisitShell({ describedBy: "reason", report: null }), keep);
  const labels = findAll(tree, node => node.type === "label").map(textOf);
  assert.ok(labels.includes("Height (cm)"));
  assert.ok(labels.includes("Stem Diameter (mm)"), labels.join(" | "));
  assert.equal(labels.some(label => /Diameter \(cm\)/.test(label)), false);
  const rows = definitions(tree).map(([label]) => label);
  for (const label of ["Planting Site Name", "Barangay / Address", "Verification Status", "Automatic 10% Sample Target", "Sample Registration Status", "Registered Sample Tree Count", "Current Monitoring Status"]) {
    assert.ok(rows.includes(label), label);
  }
});

const detail = { id: "VPMV-1", status: "DRAFT", version: 1, sampleAssessments: [{ sampleId: "TREE-A", condition: "", evidenceHistory: [] }],
  visitContext: { site, treeMarkers: [], samples: [{ sampleId: "TREE-A", species: "Narra" }], history: [] } };
const formProps = pending => ({ detail, assessments: [{ sampleId: "TREE-A", condition: "", remarks: "", heightCentimeters: "", stemDiameterMillimeters: "", mortalityCause: "", recheckReason: "", investigationOutcome: "", searchFindings: "" }],
  activeTreeId: "TREE-A", onTree() {}, errors: {}, onChange() {}, onSave() {}, saving: false, onCapture() {}, onUpload() {}, pendingFor: () => pending,
  onDiscard() {}, onView() {}, evidenceUrls: {}, evidenceKey: () => "", visitRemarks: "", onVisitRemarks() {}, dateMonitored: "2026-11-24", onDateMonitored() {}, questions: {}, onQuestion() {} });
const mapStatus = pending => {
  const tree = expand(PermanentSampleVisitForm(formProps(pending)), keep);
  return findAll(tree, node => node.type === PlantingLocationMap)[0].props.status;
};

test("D-8: a captured photo that is not uploaded yet is pending upload, never 'Verifying'", () => {
  const pending = { previewUrl: "blob:x", descriptor: { source: "browser-camera" }, location: { latitude: 12.6623, longitude: 123.933, accuracyMeters: 5 } };
  assert.notEqual(mapStatus(pending).label, "Verifying");
  assert.equal(mapStatus(pending).label, "Pending Upload");
  assert.equal(mapStatus(undefined).label, "Awaiting Photo");
});

const section = (tree, heading) => findAll(tree, node => node.type === "section" && findAll(node.props?.children, child => child.type === "h3" && textOf(child).startsWith(heading)).length > 0)[0];

test("M4: Section 2 reads the readiness context, so Section 1 and Section 2 show the same visit number", () => {
  const tree = expand(PermanentSampleVisitShell({ describedBy: "reason", report: readinessRow() }), keep);
  const summary = new Map(definitions(section(tree, "2.")));
  assert.equal(new Map(definitions(section(tree, "1."))).get("Monitoring Visit Number"), "1");
  assert.equal(summary.get("Monitoring Visit"), "1");
  assert.equal(summary.get("Schedule Status"), "First Visit Available");
  assert.equal(summary.get("Next Monitoring Date"), "Available now (no fixed first-visit due date)");
  assert.equal(summary.get("Start Monitoring Date"), "Set by the Visit 1 monitoring date");
  assert.doesNotMatch(textOf(section(tree, "2.")), /Not assigned|DUE/);
});

test("M4: a later visit shows the backend opening date and a readable schedule status", () => {
  const row = { ...readinessRow({ nextVisitNumber: 2, monitoringStatus: "SCHEDULED", sampleRegistrationStatus: "APPROVED", registeredSampleCount: 3 }),
    registersBaseline: undefined, nextVisitNumber: 2, nextScheduledDueDate: "2026-12-24", openingDate: "2026-12-24", scheduleStatus: "SCHEDULED", canCreateVisit: false };
  const summary = new Map(definitions(section(expand(PermanentSampleVisitShell({ describedBy: "reason", report: row }), keep), "2.")));
  assert.equal(summary.get("Monitoring Visit"), "2");
  assert.equal(summary.get("Next Monitoring Date"), "2026-12-24");
  assert.equal(summary.get("Schedule Status"), "Scheduled");
});

test("M4: without a readiness row Section 2 keeps the honest pending values", () => {
  const summary = new Map(definitions(section(expand(PermanentSampleVisitShell({ describedBy: "reason", report: null }), keep), "2.")));
  assert.equal(summary.get("Monitoring Visit"), "Not assigned");
  assert.equal(summary.get("Schedule Status"), "Pending Official Schedule");
});

test("first-visit empty Tree ID text describes Visit 1 baseline registration; legacy keeps the sampling-plan text", () => {
  const firstVisit = textOf(section(expand(PermanentSampleVisitShell({ describedBy: "reason", report: { ...readinessRow(), registersBaseline: true } }), keep), "4."));
  assert.match(firstVisit, /Visit 1 registers the baseline/);
  assert.doesNotMatch(firstVisit, /sampling plan/);
  const noSelection = textOf(section(expand(PermanentSampleVisitShell({ describedBy: "reason", report: null, firstVisit: true }), keep), "4."));
  assert.match(noSelection, /Visit 1 registers the baseline/);
  const legacy = textOf(section(expand(PermanentSampleVisitShell({ describedBy: "reason", report: null }), keep), "4."));
  assert.match(legacy, /Tree IDs come from an Admin-approved sampling plan and baseline\./);
});

const reviewDetail = status => ({ ...detail, status, sampleAssessments: [{ sampleId: "TREE-A", condition: "Needs Rechecking", remarks: "Tag hidden", recheckReason: "Tag could not be confirmed", diameterCentimeters: 6, evidenceHistory: [] }] });
// The page's formAssessment converts legacy centimetres, so the local row differs from the raw server row.
const reviewRow = { sampleId: "TREE-A", condition: "Needs Rechecking", remarks: "Tag hidden", heightCentimeters: "", stemDiameterMillimeters: 60, mortalityCause: "", recheckReason: "Tag could not be confirmed", investigationOutcome: "", searchFindings: "" };
const treeState = tree => textOf(findAll(tree, node => node.props?.className === "psm-tree-state")[0]);

test("the read-only Admin review never labels a tree Unsaved; it shows the server state", () => {
  for (const [status, label] of [["PENDING_ADMIN_APPROVAL", "Submitted"], ["APPROVED", "Submitted"], ["DRAFT", "Saved"]]) {
    const tree = expand(PermanentSampleVisitForm({ ...formProps(undefined), detail: reviewDetail(status), assessments: [reviewRow], readOnly: true }), keep);
    const state = treeState(tree);
    assert.doesNotMatch(state, /Unsaved/, status);
    assert.match(state, new RegExp(`· ${label}`), status);
  }
  // The editable Staff form still reports genuinely unsaved local edits.
  const editable = expand(PermanentSampleVisitForm({ ...formProps(undefined), detail: reviewDetail("DRAFT"), assessments: [{ ...reviewRow, remarks: "Changed locally" }] }), keep);
  assert.match(treeState(editable), /Unsaved/);
});

test("D-A: the saved Reason for Rechecking is displayed in the form", () => {
  const tree = expand(PermanentSampleVisitForm({ ...formProps(undefined), detail: reviewDetail("PENDING_ADMIN_APPROVAL"), assessments: [reviewRow], readOnly: true }), keep);
  const reason = findAll(tree, node => node.type === "textarea" && node.props.id === "sample-TREE-A-recheckReason")[0];
  assert.ok(reason, "the Reason for Rechecking field is rendered");
  assert.equal(reason.props.value, "Tag could not be confirmed");
});
