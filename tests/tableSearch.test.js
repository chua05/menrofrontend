import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSearchIndex, matchesSearch } from "../src/utils/recordSearch.js";
import {
  generatedReportSearchFields,
  monitoringRecordSearchFields,
  plantingReportSearchFields,
  plantingSiteSearchFields,
  registryUserSearchFields,
  seedlingRequestSearchFields,
} from "../src/utils/tableSearchFields.js";
import { trackingMatchesRecordFilters } from "../src/utils/monitoringTracking.js";
import { visitMatchesRecordFilters } from "../src/utils/adminMonitoringVisitReview.js";

const hit = (fields, query) => matchesSearch(buildSearchIndex(fields), query);
const page = (name) => readFileSync(new URL(`../src/pages/${name}`, import.meta.url), "utf8");

test("Seedling Requests: ID, requester, barangay, species, quantity, dates, status", () => {
  const request = {
    requestNumber: "REQ-2026-014", requesterName: "Maria Santos", requesterRole: "Participant", barangay: "Zone 1", organization: "Youth Org",
    requestType: "New Request", purpose: "Tree Planting", purposeDetails: "Riverbank", status: "Reviewed",
    requestDate: "2026-10-12T02:30:00.000Z", approvedDate: "2026-10-15T01:00:00.000Z",
    trees: [{ treeName: "Narra", quantity: 1200 }, { treeName: "Mahogany", quantity: 30 }],
  };
  const fields = seedlingRequestSearchFields(request, { displayId: "REQ-2026-014", secondaryDate: request.approvedDate });
  for (const query of ["REQ-2026-014", "req 2026", "zone 1", "narra", "1,200", "1200", "1230", "2026-10-12", "Oct 12, 2026", "10/12/2026", "12 Oct 2026",
    "oct 15, 2026", "awaiting approval", "reviewed", "youth org", "riverbank", "maria narra"]) assert.ok(hit(fields, query), query);
  assert.equal(hit(fields, "kalamansi"), false);
  assert.equal(hit(fields, "narra 999"), false);
  assert.equal(hit(seedlingRequestSearchFields(request, { displayId: "REQ-2026-014" }), "oct 15, 2026"), false);
});

test("Planting Reports: report ID, participant, site, barangay, species, quantity, date, status", () => {
  const record = {
    id: "abc123", reportNumber: "RPT-2026-007", reportType: "standalone", participantName: "Juan Cruz", siteName: "Riverside Site", barangay: "Zone 2",
    species: "Narra", quantityPlanted: 250, plantingDate: "2026-10-12", reportingProgress: "Completed",
    workflowStatus: "Pending Review",
  };
  const staff = plantingReportSearchFields(record, { role: "staff" });
  for (const query of ["RPT-2026-007", "juan cruz", "riverside", "zone 2", "narra", "250", "2026-10-12", "Oct 12, 2026", "awaiting review"]) assert.ok(hit(staff, query), query);
  assert.equal(hit(plantingReportSearchFields(record, { role: "participant" }), "juan cruz"), false, "participant column is not shown to participants");
  assert.ok(hit(plantingReportSearchFields(record, { role: "participant" }), "submitted"));
  const parent = { id: "p1", reportType: "parent", reportNumber: "RPT-2026-009", activeSubmittedQuantity: 40, quantityReleased: 1000, remainingAvailableQuantity: 960,
    allocationSummary: [{ species: "Mahogany", allocated: 1000 }], siteName: "Hill Site" };
  const fields = plantingReportSearchFields(parent, { role: "admin" });
  for (const query of ["mahogany", "1,000", "960", "available for future planting", "awaiting submission"]) assert.ok(hit(fields, query), query);
});

test("Planting Sites: IDs, names, barangay, location, status, condition, capacity", () => {
  const site = { id: "s1", siteId: "SITE-2026-004", siteName: "Coastal Strip", barangay: "Zone 3", locationDescription: "Near the old pier",
    maximumCapacity: 2000, verifiedPlanted: 1900, treeCondition: "Healthy", coordinatorContact: "09171234567", coordinator: "Ana" };
  const fields = plantingSiteSearchFields(site);
  for (const query of ["SITE-2026-004", "coastal", "zone 3", "old pier", "full", "healthy", "2,000", "1900"]) assert.ok(hit(fields, query), query);
  assert.equal(hit(fields, "09171234567"), false, "coordinator contact is not indexed");
  assert.ok(hit(plantingSiteSearchFields({ siteName: "X" }), "not yet monitored"));
});

test("Tree Survival Monitoring: lifecycle, tracking and visit rows", () => {
  const record = { id: "MON-ab12cd", monitoringNumber: "MON-2026-003", plantingReportNumber: "RPT-2026-007", plantingReportId: "rptdoc1", siteName: "Riverside Site",
    barangay: "Zone 2", species: "Narra", condition: "Healthy", status: "Monitoring Scheduled", startMonitoringDate: "2026-11-01", nextMonitoringDate: "2027-02-01" };
  const fields = monitoringRecordSearchFields(record, { earlyLabel: "Early: Available" });
  for (const query of ["MON-2026-003", "RPT-2026-007", "riverside", "zone 2", "narra", "healthy", "Nov 1, 2026", "02/01/2027", "early: available"]) assert.ok(hit(fields, query), query);
  assert.ok(hit(monitoringRecordSearchFields({ ...record, status: "Awaiting Monitoring Setup" }), "awaiting first monitoring visit"));
  const tracking = { reportNumber: "RPT-2026-011", siteName: "Hill Site", barangay: "Zone 4", stage: "Tracking", status: "Setup pending", startMonitoringDate: "2026-12-05", startLabel: "", nextLabel: "Not Scheduled" };
  assert.ok(trackingMatchesRecordFilters(tracking, { search: "hill zone 4 Dec 5, 2026" }));
  assert.equal(trackingMatchesRecordFilters(tracking, { search: "narra" }), false);
  const visit = { id: "VIS-1", reportNumber: "RPT-2026-007", siteName: "Riverside Site", barangay: "Zone 2", visitDate: "2026-11-20", dateMonitored: "2026-11-21", status: "PENDING_ADMIN_APPROVAL", submittedByName: "Ana Staff", progress: { completed: 3, total: 5 } };
  assert.ok(visitMatchesRecordFilters(visit, { search: "pending admin review ana 2026-11-21" }));
  assert.equal(visitMatchesRecordFilters(visit, { search: "zzz" }), false);
  const index = buildSearchIndex(["only this"]);
  assert.equal(visitMatchesRecordFilters(visit, { search: "ana", index }), false, "a precomputed index is used when supplied");
});

test("Reporting Records: report number, type, date, generator, status", () => {
  const report = { id: "docid9", reportNumber: "RPT-2026-020", type: "monthly", generatedAt: "2026-10-12T04:00:00.000Z", generatedByName: "Admin One", generatedBy: "firebase-uid-xyz", status: "Generated" };
  const fields = generatedReportSearchFields(report, { typeLabel: "Monthly Report" });
  for (const query of ["RPT-2026-020", "docid9", "monthly report", "Oct 12, 2026", "2026-10-12", "admin one", "generated"]) assert.ok(hit(fields, query), query);
  assert.equal(hit(fields, "firebase-uid-xyz"), false, "auth UID is never indexed");
});

test("Users: name, email, contact, role, barangay, status, dates; never UIDs", () => {
  const user = { uid: "uid-secret-1", fullName: "Pedro Reyes", username: "preyes", email: "pedro@example.com", contact: "09171234567", organization: "Green Club",
    barangay: "Zone 5", role: "admin", status: "Active", createdAt: "2026-10-12T03:00:00.000Z", lastLoginAt: "2026-11-02T03:00:00.000Z", userNumber: "USR-2026-002" };
  const fields = registryUserSearchFields(user);
  for (const query of ["pedro", "example.com", "0917 1234567".replace(" ", ""), "zone 5", "admin", "active", "Oct 12, 2026", "Nov 2, 2026", "USR-2026-002", "green club"]) assert.ok(hit(fields, query), query);
  assert.equal(hit(fields, "uid-secret-1"), false);
});

for (const [file, helper] of [
  ["SeedlingRequestsPage.jsx", "seedlingRequestSearchFields"],
  ["PlantingPage.jsx", "plantingReportSearchFields"],
  ["SitesPage.jsx", "plantingSiteSearchFields"],
  ["MonitoringPage.jsx", "monitoringRecordSearchFields"],
  ["ReportsPage.jsx", "generatedReportSearchFields"],
  ["UsersPage.jsx", "registryUserSearchFields"],
]) {
  test(`${file} uses the shared search util with a per-record index`, () => {
    const source = page(file);
    assert.match(source, /buildSearchIndex/);
    assert.match(source, /matchesSearch/);
    assert.ok(source.includes(helper), helper);
    assert.doesNotMatch(source, /searchable(Text)?\s*\.?includes|haystack\.includes|toLowerCase\(\)\s*\.includes\(search\)/);
  });
}

test("Seedling Requests, Reports, Users, Sites and Planting Reports drop stale list responses", () => {
  assert.match(page("SeedlingRequestsPage.jsx"), /requestsLoadSeq/);
  assert.match(page("ReportsPage.jsx"), /reportsLoadSeq/);
  assert.match(page("UsersPage.jsx"), /usersLoadSeq/);
  assert.match(page("SitesPage.jsx"), /sitesLoadSeq/);
  assert.match(page("PlantingPage.jsx"), /reportsLoadSeq/);
  assert.match(page("MonitoringPage.jsx"), /refreshLoadSeq/);
  for (const [file, re] of [["SeedlingRequestsPage.jsx", /loadSeq === requestsLoadSeq\.current\) setLoadingRequests\(false\)/], ["PlantingPage.jsx", /loadSeq === reportsLoadSeq\.current\) setLoading\(false\)/], ["ReportsPage.jsx", /loadSeq === reportsLoadSeq\.current\) setHistoryLoading\(false\)/], ["UsersPage.jsx", /loadSeq === usersLoadSeq\.current\) setLoading\(false\)/], ["MonitoringPage.jsx", /refreshSeq === refreshLoadSeq\.current\) setActionLoading\(false\)/]]) assert.match(page(file), re, `${file}: only the latest request clears loading`);
});

test("Monitoring visits: submitter and progress match what the row shows", () => {
  const base = { id: "VIS-2", reportNumber: "RPT-2026-008", siteName: "Hill Site", barangay: "Zone 3", visitDate: "2026-11-20", status: "SUBMITTED" };
  const named = { ...base, submittedByName: "Ana Staff", progress: { completed: 2, total: 5 } };
  assert.ok(visitMatchesRecordFilters(named, { search: "2/5" }), "the displayed progress fraction is searchable");
  assert.ok(visitMatchesRecordFilters(named, { search: "submitted by ana" }));
  assert.equal(visitMatchesRecordFilters(named, { search: "menro staff" }), false, "the fallback is not indexed when a name is shown");
  const fallback = { ...base, submittedByName: "", progress: null };
  assert.ok(visitMatchesRecordFilters(fallback, { search: "menro staff" }), "the fallback is indexed when it is what the row shows");
  assert.ok(visitMatchesRecordFilters(fallback, { search: "0/0 sample trees" }));
  const unavailable = { ...base, submittedByName: null };
  assert.ok(visitMatchesRecordFilters(unavailable, { search: "submitter unavailable" }));
  assert.equal(visitMatchesRecordFilters(unavailable, { search: "menro staff" }), false);
});
