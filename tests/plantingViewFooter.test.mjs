import test from "node:test";
import assert from "node:assert/strict";
import { automatedCheckLabel, roleWorkflowLabel, viewFooterDecisions, WORKFLOW_STATUS } from "../src/utils/plantingReviewWorkflow.js";

const participant = (id, workflowStatus) => ({ id, workflowStatus });
const official = (id, workflowStatus) => ({ id, workflowStatus, officialStaffReport: true });

test("footer offers Review only to Staff for Submitted participant reports, never for Staff-submitted reports", () => {
  const submissions = [participant("p-submitted", "Pending Review"), participant("p-reviewed", "Reviewed"), official("s-pending", "Pending Admin Approval")];
  assert.deepEqual(viewFooterDecisions({ submissions, role: "staff" }).map(row => [row.name, row.actions]), [["p-submitted", ["forward", "return"]]]);
});

test("footer offers Verify to Admin for Reviewed participant reports and Staff-submitted reports only", () => {
  const submissions = [participant("p-submitted", "Pending Review"), participant("p-reviewed", "Reviewed"), official("s-pending", "Pending Admin Approval")];
  assert.deepEqual(viewFooterDecisions({ submissions, role: "admin" }).map(row => [row.name, row.actions]),
    [["p-reviewed", ["approve", "reject"]], ["s-pending", ["approve", "reject", "return"]]]);
});

test("verified, returned, rejected and Participant views have no footer decisions", () => {
  const submissions = ["Completed", "Returned for Correction", "Rejected"].flatMap(status => [participant(`p-${status}`, status), official(`s-${status}`, status)]);
  for (const role of ["staff", "admin", "participant"]) assert.deepEqual(viewFooterDecisions({ submissions, role }), []);
  assert.deepEqual(viewFooterDecisions({ submissions: [participant("p", "Pending Review"), participant("q", "Reviewed")], role: "participant" }), []);
});

test("final-report rows are decided once on their first row, and a legacy standalone report gets one row", () => {
  const rows = viewFooterDecisions({ submissions: [participant("lead", "Pending Review"), participant("member", "Pending Review")], role: "staff",
    isGroupLead: submission => submission.id === "lead" });
  assert.deepEqual(rows.map(row => row.label), ["Decision for submission lead"]);
  const standalone = viewFooterDecisions({ standaloneReview: { id: "legacy", workflowStatus: "Reviewed" }, role: "admin" });
  assert.deepEqual(standalone.map(row => [row.label, row.actions]), [["Decision for this planting report", ["approve", "reject"]]]);
});

test("Verified is only the label of the Admin-verified stage; the automated GPS check is never called Verified", () => {
  for (const role of ["staff", "admin"]) {
    assert.equal(roleWorkflowLabel(WORKFLOW_STATUS.COMPLETED, role), "Verified");
    for (const stage of [WORKFLOW_STATUS.PENDING_REVIEW, WORKFLOW_STATUS.REVIEWED, WORKFLOW_STATUS.PENDING_ADMIN_APPROVAL]) assert.notEqual(roleWorkflowLabel(stage, role), "Verified");
  }
  assert.equal(roleWorkflowLabel(WORKFLOW_STATUS.PENDING_ADMIN_APPROVAL, "admin"), "Staff Submitted");
  assert.equal(automatedCheckLabel("Verified"), "GPS Check Passed");
  assert.equal(automatedCheckLabel("Needs Review"), "Needs Review");
  assert.equal(automatedCheckLabel(""), "Needs Review");
});
