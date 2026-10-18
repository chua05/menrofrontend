import test from "node:test";
import assert from "node:assert/strict";
import {
  getNotificationPath,
  getUnreadCountsByPath,
} from "../src/utils/notificationRoutes.js";

test("notification records map to the correct staff pages", () => {
  assert.equal(
    getNotificationPath({ relatedRecordType: "seedlingRequest", relatedRecordId: "request/1" }, "staff"),
    "/staff/requests?request=request%2F1",
  );
  assert.equal(
    getNotificationPath({ relatedRecordType: "inventory" }, "staff"),
    "/staff/seedlings",
  );
  assert.equal(
    getNotificationPath({ relatedRecordType: "plantingReport", relatedRecordId: "report-1", relatedSubrecordId: "submission-2" }, "staff"),
    "/staff/planting-reports?report=report-1&contribution=submission-2",
  );
  assert.equal(
    getNotificationPath({ relatedEventId: "event-1" }, "staff"),
    "/staff/event-calendar?event=event-1",
  );
});

test("participant request and report notifications use participant pages", () => {
  assert.equal(
    getNotificationPath({ relatedRecordType: "seedlingRequest", relatedRecordId: "request-1" }, "participant"),
    "/participant/my-requests?request=request-1",
  );
  assert.equal(
    getNotificationPath({ relatedRecordType: "plantingReport" }, "participant"),
    "/participant/my-planting-reports",
  );
  assert.equal(
    getNotificationPath({ relatedRecordType: "inventory" }, "participant"),
    null,
  );
});

test("monitoring notifications route to the exact lifecycle and observation", () => {
  assert.equal(getNotificationPath({
    relatedRecordType: "monitoring",
    relatedRecordId: "report-1",
    relatedSubrecordId: "observation-1",
  }, "participant"), "/participant/survival-monitoring?monitoring=report-1&observation=observation-1");
});

test("inventory and distribution notifications route to their operational records", () => {
  assert.equal(getNotificationPath({
    relatedRecordType: "inventory", relatedRecordId: "inventory-1",
  }, "staff"), "/staff/seedlings?inventory=inventory-1");
  assert.equal(getNotificationPath({
    relatedRecordType: "distribution", relatedRecordId: "distribution-1",
  }, "admin"), "/admin/seedlings?tab=distribution&distribution=distribution-1");
  assert.equal(getNotificationPath({
    relatedRecordType: "distribution", relatedRecordId: "distribution-1",
  }, "participant"), null);
});

test("unsupported notifications and roles use a safe fallback", () => {
  assert.equal(getNotificationPath({ relatedRecordType: "unknown" }, "staff"), null);
  assert.equal(getNotificationPath({ relatedRecordType: "seedlingRequest" }, "unknown"), null);
});

test("only unread notifications contribute to each sidebar badge", () => {
  const counts = getUnreadCountsByPath([
    { relatedRecordType: "seedlingRequest", isRead: false },
    { relatedRecordType: "seedlingRequest", isRead: false },
    { relatedRecordType: "seedlingRequest", isRead: true },
    { relatedRecordType: "inventory", isRead: false },
  ], "staff");

  assert.deepEqual(counts, {
    "/staff/requests": 2,
    "/staff/seedlings": 1,
  });
});
