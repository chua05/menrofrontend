export const GROUP_SECTORS = new Set([
  "Barangay Official",
  "School / Student",
  "Private Sector / Business",
  "Civic Organization / NGO",
  "Government Agency",
]);

export const INDIVIDUAL_PURPOSES = [
  "Backyard / Home Planting",
  "Fruit-Bearing Tree Planting",
  "Farm / Agricultural Planting",
  "Land Rehabilitation / Reforestation",
  "Replacement Planting",
  "Environmental Conservation",
  "Other (Please Specify)",
];

// Keep the existing organization choices intact.
export const ORGANIZATION_PURPOSES = [
  "Tree Planting Activity",
  "Reforestation / Rehabilitation",
  "School Activity",
  "Barangay Activity",
  "Community Activity",
  "Replacement Planting",
  "Environmental Program",
  "Personal Planting",
  "Other",
];

export const EXACT_AREA_CHOICES = new Set([
  "Less than 1 hectare",
  "6–10 hectares",
  "More than 10 hectares",
  "Other / Exact Area",
]);

export const REQUEST_LETTER_MAX_BYTES = 10 * 1024 * 1024;
export const MAX_SEEDLING_TYPES = 10;
const REQUEST_LETTER_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "docx"]);
const REQUEST_LETTER_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function getEffectiveRequestType(sector, requestingAs) {
  return (
    GROUP_SECTORS.has(sector) ||
    (sector === "Other (please specify)" && requestingAs === "group")
  ) ? "organization" : "individual";
}

export function isGroupRequester(sector, requestingAs) {
  return getEffectiveRequestType(sector, requestingAs) === "organization";
}

export function getPurposeOptions(sector, requestingAs) {
  return getEffectiveRequestType(sector, requestingAs) === "organization"
    ? ORGANIZATION_PURPOSES
    : INDIVIDUAL_PURPOSES;
}

export function isOtherPurpose(purpose) {
  return ["Other", "Other (Please Specify)"].includes(String(purpose || ""));
}

export function normalizeBarangayName(value) {
  const cleaned = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const zoneMatch = /^zone\s*(1|2|3|4|5|6|7|8|i|ii|iii|iv|v|vi|vii|viii)(?:\s*poblacion)?$/.exec(cleaned);
  if (!zoneMatch) return cleaned;
  const zones = { "1": "i", "2": "ii", "3": "iii", "4": "iv", "5": "v", "6": "vi", "7": "vii", "8": "viii" };
  return `zone ${zones[zoneMatch[1]] || zoneMatch[1]}`;
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
    return "Please upload a PDF, JPG, JPEG, PNG, or DOCX file.";
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

export function addWorkingDays(dateOnly, count) {
  const date = new Date(`${dateOnly}T12:00:00+08:00`);
  let added = 0;
  while (added < count) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila", weekday: "short",
    }).format(date);
    if (weekday !== "Sat" && weekday !== "Sun") added += 1;
  }
  return dateOnlyInManila(date);
}

export function getProcessingWindowAdvisory(preferredReleaseDate, now = new Date()) {
  if (!isValidDateOnly(preferredReleaseDate)) return null;
  const submittedDate = dateOnlyInManila(now);
  const earliestDate = addWorkingDays(submittedDate, 3);
  const latestDate = addWorkingDays(submittedDate, 7);
  return preferredReleaseDate < earliestDate ? { earliestDate, latestDate } : null;
}

export function isValidDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function formatScheduleTime(value, missingLabel = "") {
  if (!value) return missingLabel;
  const timeOnly = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value).trim());
  if (timeOnly) {
    const hour = Number(timeOnly[1]);
    const minute = Number(timeOnly[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
        .format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return missingLabel || "Not specified";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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
