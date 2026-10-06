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
