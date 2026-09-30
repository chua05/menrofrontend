import test from "node:test";
import assert from "node:assert/strict";
import { getEventStatus } from "../src/utils/eventStatus.js";

const event = {
  date: "2026-10-01",
  startTime: "09:00",
  endTime: "11:00",
};

test("future events are Upcoming", () => {
  assert.equal(getEventStatus(event, new Date(2026, 9, 1, 8, 59)), "Upcoming");
});

test("events are Ongoing from their start through their end time", () => {
  assert.equal(getEventStatus(event, new Date(2026, 9, 1, 9, 0)), "Ongoing");
  assert.equal(getEventStatus(event, new Date(2026, 9, 1, 11, 0)), "Ongoing");
});

test("events become Completed after their end date and time", () => {
  assert.equal(getEventStatus(event, new Date(2026, 9, 1, 11, 1)), "Completed");
  assert.equal(getEventStatus(event, new Date(2026, 9, 2, 0, 0)), "Completed");
});

test("stored workflow statuses do not override the event schedule", () => {
  assert.equal(getEventStatus({ ...event, status: "Cancelled" }, new Date(2026, 8, 1)), "Upcoming");
  assert.equal(getEventStatus({ ...event, status: "Completed" }, new Date(2026, 9, 1, 0, 0)), "Upcoming");
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
      new Date(2026, 9, 1, 0, 0)
    ),
    "Upcoming"
  );
});
