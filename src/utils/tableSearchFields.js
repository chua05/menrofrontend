// Field lists for the searchable record tables. Each helper returns the values a table row actually
// shows (plus the non-confidential record ID/name fields the page already matched), ready for
// buildSearchIndex(). Numbers stay numbers and dates stay raw so the shared search util can match
// "1,000", "2026-10-12" and "Oct 12, 2026". Never add UIDs, tokens, ID documents or hidden contact data.
import { formatDisplayId } from "./displayId.js";
import { lifecycleMonitoringView, monitoringDisplayId, monitoringStatusLabel } from "./monitoringRecordView.js";
import { monitoringScheduleLabel } from "./monitoringForm.js";
import { reportReviewStages, reportReviewStatus, reportSeedlingItems, reportSubmissionStatus } from "./plantingReportView.js";
import { roleWorkflowLabel } from "./plantingReviewWorkflow.js";
import { plantedOf, siteUtilization } from "./siteUtilization.js";

const REQUEST_STATUS_LABELS = Object.freeze({ Reviewed: "Awaiting Approval", "Saplings Released": "Seedlings Released" });
const ROLE_LABELS = Object.freeze({ admin: "Admin", staff: "Staff", participant: "Participant" });

export const seedlingRequestStatusLabel = (status) => REQUEST_STATUS_LABELS[status] || status;

// Seedling Requests table: request ID, requester, barangay/organization, type, seedlings (species,
// quantity, total), purpose, request date and the Approved/Rejected date column of that tab.
export function seedlingRequestSearchFields(request, { displayId = "", secondaryDate = "" } = {}) {
  const trees = Array.isArray(request?.trees) ? request.trees : [];
  const total = trees.reduce((sum, tree) => sum + Number(tree?.quantity || 0), 0);
  return [
    displayId, request?.requestNumber, request?.requestId,
    request?.requesterName, request?.requesterRole || "Requester",
    request?.barangay, request?.organization, request?.requestType,
    trees.flatMap((tree) => [tree?.treeName, tree?.quantity]), total, "seedlings",
    request?.purpose, request?.purposeDetails,
    request?.requestDate, secondaryDate,
    request?.status, seedlingRequestStatusLabel(request?.status),
  ];
}

// Planting Reports table (Staff/Admin see the participant column; Participants do not).
export function plantingReportSearchFields(record, { role = "", displayStatus = (status) => status } = {}) {
  const isParticipant = role === "participant";
  const items = reportSeedlingItems(record);
  const stages = reportReviewStages(record);
  const reviewLabels = (stages.length > 1 ? stages : [reportReviewStatus(record)]).map((stage) => roleWorkflowLabel(stage, role));
  const parent = record?.reportType === "parent";
  return [
    formatDisplayId("RPT", record?.reportNumber, record?.reportId, record?.id), record?.reportNumber, record?.id,
    isParticipant ? "" : record?.participantName,
    record?.siteName, record?.barangay,
    items.flatMap((item) => [item.species, item.quantity]), record?.species,
    parent
      ? [record?.activeSubmittedQuantity, record?.quantityReleased, record?.remainingAvailableQuantity, "reported planted", "released", "available for future planting"]
      : record?.quantityPlanted,
    record?.plantingDate, record?.eventName,
    displayStatus(reportSubmissionStatus(record)), reviewLabels,
    record?.verificationStatus, record?.reportingProgress,
  ];
}

// Planting Sites list/map: site IDs and names, barangay, location, capacity, planted count, status, condition.
export function plantingSiteSearchFields(site) {
  const utilization = siteUtilization(site);
  return [
    site?.id, site?.siteId, site?.siteName, site?.barangay, site?.locationDescription,
    site?.siteType, site?.customSiteType, site?.ownershipType, site?.relatedEventName, site?.coordinator,
    utilization.label, site?.treeCondition || "Not Yet Monitored",
    utilization.capacity, plantedOf(site),
  ];
}

// Survival Monitoring lifecycle row (Monitoring ID, report, site/barangay, dates, status, condition).
export function monitoringRecordSearchFields(record, { earlyLabel = "" } = {}) {
  const view = lifecycleMonitoringView(record);
  return [
    monitoringDisplayId(record), record?.monitoringNumber, record?.id,
    formatDisplayId("RPT", record?.plantingReportNumber, record?.plantingReportId), record?.plantingReportNumber, record?.plantingReportId,
    record?.siteName, record?.barangay, record?.species, record?.participant,
    view ? [view.start, view.startNote, view.next || "Not Scheduled", view.nextNote, view.latest] : [record?.startMonitoringDate, record?.nextMonitoringDate || monitoringScheduleLabel(record)],
    view?.status || monitoringStatusLabel(record?.status), monitoringStatusLabel(record?.status), earlyLabel,
    view?.condition || record?.condition,
  ];
}

// Reporting Records (generated reports history).
export function generatedReportSearchFields(report, { typeLabel = "" } = {}) {
  return [
    formatDisplayId("RPT", report?.reportNumber, report?.id), report?.reportNumber, report?.id,
    typeLabel, report?.type, report?.generatedAt, report?.generatedByName, report?.status,
  ];
}

// Registered users table. Shows name, email, contact, role, barangay, dates and status; never UIDs.
export function registryUserSearchFields(user) {
  return [
    user?.fullName, user?.username, user?.email, user?.contact, user?.organization,
    user?.barangay, user?.role, ROLE_LABELS[user?.role], user?.status,
    user?.userNumber, user?.createdAt, user?.lastLoginAt,
  ];
}
