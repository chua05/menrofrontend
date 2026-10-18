import test from "node:test";
import assert from "node:assert/strict";
import { getEventStatus } from "../src/utils/eventStatus.js";

const event = {
  date: "2026-10-01",
  startTime: "09:00",
  endTime: "11:00",
};

test("future events are Upcoming", () => {
  assert.equal(getEventStatus(event, new Date("2026-10-01T00:59:00Z")), "Upcoming");
});

test("events are Ongoing from their start through their end time", () => {
  assert.equal(getEventStatus(event, new Date("2026-10-01T01:00:00Z")), "Ongoing");
  assert.equal(getEventStatus(event, new Date("2026-10-01T03:00:00Z")), "Ongoing");
});

test("events become Completed after their end date and time", () => {
  assert.equal(getEventStatus(event, new Date("2026-10-01T03:01:00Z")), "Completed");
  assert.equal(getEventStatus(event, new Date("2026-10-01T16:00:00Z")), "Completed");
});

test("stored workflow statuses do not override the event schedule", () => {
  assert.equal(getEventStatus({ ...event, status: "Cancelled" }, new Date("2026-09-01T00:00:00Z")), "Upcoming");
  assert.equal(getEventStatus({ ...event, status: "Completed" }, new Date("2026-09-30T16:00:00Z")), "Upcoming");
});

test("a Thursday 7 AM event is Upcoming at midnight on Thursday", () => {
  assert.equal(
    getEventStatus(
      {
        date: "2026-10-01",
        startTime: "07:00",
        endTime: "13:00",
        status: "Completed",
      },
      new Date("2026-09-30T16:00:00Z")
    ),
    "Upcoming"
  );
});

test("uses Manila time independently of the browser timezone", () => {
  assert.equal(getEventStatus({ date: "2026-10-01", startTime: "00:30", endTime: "01:30" },
    new Date("2026-09-30T16:30:00Z")), "Ongoing");
});

test("missing end time lasts through the Manila calendar day", () => {
  const legacy = { date: "2026-10-01", startTime: "09:00", endTime: "" };
  assert.equal(getEventStatus(legacy, new Date("2026-10-01T10:00:00Z")), "Ongoing");
  assert.equal(getEventStatus(legacy, new Date("2026-10-01T16:00:00Z")), "Completed");
});

test("invalid legacy schedules are explicit", () => {
  assert.equal(getEventStatus({ date: "2026-02-30", startTime: "09:00", endTime: "10:00" }), "Invalid Schedule");
  assert.equal(getEventStatus({ date: "2026-10-01", startTime: "", endTime: "10:00" }), "Invalid Schedule");
  assert.equal(getEventStatus({ date: "2026-10-01", startTime: "25:00", endTime: "26:00" }), "Invalid Schedule");
});
