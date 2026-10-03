import test from "node:test";
import assert from "node:assert/strict";
import {
  getNotificationPath,
  getUnreadCountsByPath,
} from "../src/utils/notificationRoutes.js";

test("notification records map to the correct staff pages", () => {
  assert.equal(
    getNotificationPath({ relatedRecordType: "seedlingRequest" }, "staff"),
    "/staff/requests",
  );
  assert.equal(
    getNotificationPath({ relatedRecordType: "inventory" }, "staff"),
    "/staff/seedlings",
  );
  assert.equal(
    getNotificationPath({ relatedRecordType: "plantingReport" }, "staff"),
    "/staff/planting-reports",
  );
  assert.equal(
    getNotificationPath({ relatedEventId: "event-1" }, "staff"),
    "/staff/event-calendar",
  );
});

test("participant request and report notifications use participant pages", () => {
  assert.equal(
    getNotificationPath({ relatedRecordType: "seedlingRequest" }, "participant"),
    "/participant/my-requests",
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
