export const GROUP_SECTORS = new Set([
  "Barangay Official",
  "School / Student",
  "Private Sector / Business",
  "Civic Organization / NGO",
  "Government Agency",
]);

export const EXACT_AREA_CHOICES = new Set([
  "Less than 1 hectare",
  "6–10 hectares",
  "More than 10 hectares",
  "Other / Exact Area",
]);

export const REQUEST_LETTER_MAX_BYTES = 10 * 1024 * 1024;
const REQUEST_LETTER_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);
const REQUEST_LETTER_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export function isGroupRequester(sector, requestingAs) {
  return (
    GROUP_SECTORS.has(sector) ||
    (sector === "Other (please specify)" && requestingAs === "group")
  );
}

export function getPlantingAreaHectares(areaChoice, exactArea) {
  if (EXACT_AREA_CHOICES.has(areaChoice)) return Number(exactArea) || 0;
  const exactChoices = {
    "1 hectare": 1,
    "2 hectares": 2,
    "3 hectares": 3,
    "4 hectares": 4,
    "5 hectares": 5,
  };
  return exactChoices[areaChoice] || 0;
}

export function getPlantingAreaError(areaChoice, exactArea) {
  if (!areaChoice) return "Select the planting area.";
  if (!EXACT_AREA_CHOICES.has(areaChoice)) return "";
  const value = Number(exactArea);
  if (!Number.isFinite(value) || value <= 0)
    return "Enter a positive planting area in hectares.";
  if (areaChoice === "Less than 1 hectare" && value >= 1)
    return "Enter an area greater than 0 and less than 1 hectare.";
  if (areaChoice === "6–10 hectares" && (value < 6 || value > 10))
    return "Enter an area from 6 to 10 hectares.";
  if (areaChoice === "More than 10 hectares" && value <= 10)
    return "Enter an area greater than 10 hectares.";
  return "";
}

export function getStepState(
  stepNumber,
  currentStep,
  completedSteps,
  highestUnlockedStep,
) {
  if (stepNumber === currentStep) return "current";
  if (completedSteps.has(stepNumber)) return "complete";
  return stepNumber <= highestUnlockedStep ? "unlocked" : "locked";
}

export function canNavigateToStep(
  stepNumber,
  currentStep,
  highestUnlockedStep,
) {
  return stepNumber !== currentStep && stepNumber <= highestUnlockedStep;
}

export function invalidateCompletedSteps(
  completedSteps,
  changedStep,
  invalidateDownstream = false,
) {
  if (invalidateDownstream) {
    return new Set(
      [...completedSteps].filter((completedStep) => completedStep < changedStep),
    );
  }
  const next = new Set(completedSteps);
  next.delete(changedStep);
  return next;
}

export function validateRequestLetterFile(file) {
  const extension = String(file?.name || "").split(".").pop().toLowerCase();
  if (
    !REQUEST_LETTER_EXTENSIONS.has(extension) ||
    (file?.type && !REQUEST_LETTER_TYPES.has(file.type))
  ) {
    return "Please upload a PDF, JPG, JPEG, or PNG file.";
  }
  if (Number(file?.size) > REQUEST_LETTER_MAX_BYTES)
    return "File size must not exceed 10 MB.";
  return "";
}

export function dateOnlyInManila(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).filter((part) => part.type !== "literal")
    .map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isValidDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function dateOnlyValue(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function validatePlantingSchedule({ date, startTime, endTime, group, participants }, now = new Date()) {
  const errors = {};
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!date) errors.activityDate = group
    ? "Please select an event date." : "Please select a planned planting date.";
  else if (!isValidDateOnly(date)) errors.activityDate = group
    ? "Please select a valid event date." : "Please select a valid planned planting date.";
  else if (dateOnlyValue(date) < dateOnlyValue(dateOnlyInManila(now))) errors.activityDate = group
    ? "The event date cannot be in the past." : "The planting date cannot be in the past.";

  if (!startTime) errors.startTime = group
    ? "Please select an event start time." : "Please select a planned start time.";
  else if (!timePattern.test(startTime)) errors.startTime = group
    ? "Please select a valid event start time." : "Please select a valid planned start time.";
  else if (!errors.activityDate) {
    const start = new Date(`${date}T${startTime}:00+08:00`);
    if (Number.isNaN(start.getTime()) || start.getTime() <= now.getTime()) {
      errors.startTime = group
        ? "The event start time must be in the future."
        : "The planned start time must be in the future.";
    }
  }

  if (group) {
    if (!endTime) errors.endTime = "Please select an event end time.";
    else if (!timePattern.test(endTime)) errors.endTime = "Please select a valid event end time.";
    else if (timePattern.test(startTime || "") && endTime <= startTime) {
      errors.endTime = "Event end time must be later than the start time.";
    }
  }

  if (!Number.isInteger(Number(participants)) || Number(participants) <= 0) {
    errors.participants = group
      ? "Please enter a valid number of participants."
      : "Please enter a valid number of planters.";
  }
  return errors;
}
