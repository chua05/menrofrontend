import test from "node:test";
import assert from "node:assert/strict";
import {
  addWorkingDays,
  canNavigateToStep,
  getPlantingAreaError,
  getPlantingAreaHectares,
  getStepState,
  invalidateCompletedSteps,
  isGroupRequester,
  formatScheduleTime,
  getProcessingWindowAdvisory,
  normalizeBarangayName,
  validatePlantingSchedule,
  validateRequestLetterFile,
} from "../src/utils/saplingRequestWorkflow.js";

test("formats stored time-only schedule values without Invalid Date", () => {
  assert.equal(formatScheduleTime("06:00"), "06:00 AM");
  assert.equal(formatScheduleTime("", "Not specified"), "Not specified");
  assert.equal(formatScheduleTime("invalid", "Not specified"), "Not specified");
});

test("classifies individual and group requesters from sector/requesting-as", () => {
  assert.equal(isGroupRequester("Resident / Individual", ""), false);
  assert.equal(isGroupRequester("Other (please specify)", "individual"), false);
  for (const sector of [
    "Barangay Official",
    "School / Student",
    "Private Sector / Business",
    "Civic Organization / NGO",
    "Government Agency",
  ]) {
    assert.equal(isGroupRequester(sector, ""), true);
  }
  assert.equal(isGroupRequester("Other (please specify)", "group"), true);
  assert.equal(isGroupRequester("", ""), false);
});

test("request purpose does not affect requester classification", () => {
  assert.equal(isGroupRequester("Resident / Individual", ""), false);
  assert.equal(isGroupRequester("School / Student", ""), true);
});

test("derives exact hectares for fixed and custom planting-area choices", () => {
  assert.equal(getPlantingAreaHectares("1 hectare", ""), 1);
  assert.equal(getPlantingAreaHectares("5 hectares", ""), 5);
  assert.equal(getPlantingAreaHectares("Other / Exact Area", "2.5"), 2.5);
});

test("validates bounded planting-area choices", () => {
  assert.equal(getPlantingAreaError("Less than 1 hectare", "0.5"), "");
  assert.notEqual(getPlantingAreaError("Less than 1 hectare", "1"), "");
  assert.equal(getPlantingAreaError("6–10 hectares", "6"), "");
  assert.equal(getPlantingAreaError("6–10 hectares", "10"), "");
  assert.notEqual(getPlantingAreaError("6–10 hectares", "10.1"), "");
  assert.equal(getPlantingAreaError("More than 10 hectares", "10.5"), "");
  assert.notEqual(getPlantingAreaError("More than 10 hectares", "10"), "");
});

test("unlocked steps remain clickable independently of the current step", () => {
  const initial = new Set();
  assert.equal(getStepState(1, 1, initial, 1), "current");
  assert.equal(getStepState(2, 1, initial, 1), "locked");
  assert.equal(getStepState(3, 1, initial, 1), "locked");
  assert.equal(getStepState(4, 1, initial, 1), "locked");

  const stepOneComplete = new Set([1]);
  assert.equal(getStepState(1, 1, stepOneComplete, 2), "current");
  assert.equal(getStepState(2, 1, stepOneComplete, 2), "unlocked");
  assert.equal(canNavigateToStep(2, 1, 2), true);
  assert.equal(canNavigateToStep(3, 1, 2), false);

  const completed = new Set([1, 2]);
  assert.equal(getStepState(1, 3, completed, 3), "complete");
  assert.equal(getStepState(2, 3, completed, 3), "complete");
  assert.equal(getStepState(3, 3, completed, 3), "current");
  assert.equal(getStepState(4, 3, completed, 3), "locked");
  assert.equal(canNavigateToStep(1, 3, 3), true);
  assert.equal(canNavigateToStep(3, 1, 3), true);
  assert.equal(canNavigateToStep(4, 1, 3), false);

  const firstThreeComplete = new Set([1, 2, 3]);
  assert.equal(getStepState(4, 1, firstThreeComplete, 4), "unlocked");
  assert.equal(canNavigateToStep(4, 1, 4), true);
});

test("editing completion state does not reduce unlocked progression", () => {
  assert.deepEqual(
    [...invalidateCompletedSteps(new Set([1, 2, 3]), 1, true)],
    [],
  );
  assert.deepEqual(
    [...invalidateCompletedSteps(new Set([1, 2, 3]), 2)],
    [1, 3],
  );
});

test("validates request-letter type and ten-megabyte limit", () => {
  assert.equal(
    validateRequestLetterFile({
      name: "request-letter.pdf",
      type: "application/pdf",
      size: 1.8 * 1024 * 1024,
    }),
    "",
  );
  assert.equal(
    validateRequestLetterFile({ name: "request-letter.exe", size: 100 }),
    "Please upload a PDF, JPG, JPEG, PNG, or DOCX file.",
  );
  assert.equal(
    validateRequestLetterFile({
      name: "request-letter.png",
      type: "image/png",
      size: 10 * 1024 * 1024 + 1,
    }),
    "File size must not exceed 10 MB.",
  );
});

test("validates individual planting without requiring an end time", () => {
  const now = new Date("2026-10-10T09:00:00Z");
  assert.deepEqual(validatePlantingSchedule({ date: "2026-10-10", startTime: "18:00", endTime: "", group: false, participants: "1" }, now), {});
  assert.equal(validatePlantingSchedule({ date: "2026-10-10", startTime: "08:00", endTime: "", group: false, participants: "1" }, now).startTime, "The planned start time must be in the future.");
  assert.equal(validatePlantingSchedule({ date: "2026-10-09", startTime: "08:00", endTime: "", group: false, participants: "1" }, now).activityDate, "The planting date cannot be in the past.");
});

test("validates group event end time separately", () => {
  const now = new Date("2026-10-10T09:00:00Z");
  assert.deepEqual(validatePlantingSchedule({ date: "2026-10-11", startTime: "08:00", endTime: "11:00", group: true, participants: "10" }, now), {});
  assert.equal(validatePlantingSchedule({ date: "2026-10-11", startTime: "08:00", endTime: "08:00", group: true, participants: "10" }, now).endTime, "Event end time must be later than the start time.");
  assert.equal(validatePlantingSchedule({ date: "2026-10-11", startTime: "08:00", endTime: "", group: true, participants: "10" }, now).endTime, "Please select an event end time.");
});

test("accepts the reported future group schedule at 11:49 PM Manila time", () => {
  const now = new Date("2026-10-26T23:49:00+08:00");
  assert.deepEqual(validatePlantingSchedule({
    date: "2026-10-27", startTime: "04:34", endTime: "05:34",
    group: true, participants: "30",
  }, now), {});
  assert.equal(validatePlantingSchedule({
    date: "2026-10-27", startTime: "04:34", endTime: "",
    group: true, participants: "30",
  }, now).endTime, "Please select an event end time.");
});

test("keeps the 3–7 working-day period advisory only", () => {
  const now = new Date("2026-10-26T23:49:00+08:00");
  assert.equal(addWorkingDays("2026-10-26", 3), "2026-10-29");
  assert.deepEqual(getProcessingWindowAdvisory("2026-10-27", now), {
    earliestDate: "2026-10-29", latestDate: "2026-11-04",
  });
  assert.equal(getProcessingWindowAdvisory("2026-10-29", now), null);
});

test("allows same-day release and planting while the planting start remains in the future", () => {
  const beforeStart = new Date("2026-10-28T08:00:00.000Z"); // 4:00 PM Asia/Manila
  assert.deepEqual(validatePlantingSchedule({
    date: "2026-10-28", startTime: "17:00", endTime: "18:00",
    group: true, participants: "40",
  }, beforeStart), {});

  const afterStart = new Date("2026-10-28T09:01:00.000Z"); // 5:01 PM Asia/Manila
  assert.equal(validatePlantingSchedule({
    date: "2026-10-28", startTime: "17:00", endTime: "18:00",
    group: true, participants: "40",
  }, afterStart).startTime, "The event start time must be in the future.");
});

test("normalizes Arabic and Roman Zone barangay aliases", () => {
  assert.equal(normalizeBarangayName("Zone 8"), "zone viii");
  assert.equal(normalizeBarangayName(" Zone VIII "), "zone viii");
  assert.equal(normalizeBarangayName("ZoneVIIIPoblacion"), "zone viii");
  assert.equal(normalizeBarangayName("Zone VIII Poblacion"), "zone viii");
});
