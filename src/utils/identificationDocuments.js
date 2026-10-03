export const IDENTIFICATION_DOCUMENTS = Object.freeze([
  ["national_id", "National ID (PhilID / ePhilID / Digital National ID)"],
  ["passport", "Philippine Passport"],
  ["drivers_license", "Driver's License"],
  ["prc", "PRC ID"],
  ["umid_sss", "UMID / SSS ID"],
  ["gsis", "GSIS ID / eCard"],
  ["philhealth", "PhilHealth ID"],
  ["tin", "TIN ID"],
  ["postal", "Postal ID"],
  ["voter", "Voter's ID / Voter's Certification"],
  ["senior_citizen", "Senior Citizen ID"],
  ["pwd", "PWD ID"],
  ["solo_parent", "Solo Parent ID"],
  ["owwa", "OWWA ID / eCard"],
  ["seafarer", "Seafarer's ID / Seafarer's Record Book / SID"],
  ["school_id", "School ID / Student ID"],
].map(([value, label]) => Object.freeze({ value, label })));

export const IDENTIFICATION_DOCUMENT_VALUES = new Set(
  IDENTIFICATION_DOCUMENTS.map((document) => document.value),
);

export function validateIdentificationForm({
  identificationType,
  idNumber,
  schoolInstitutionName,
  confirmedInformation,
}) {
  const errors = {};
  const value = String(idNumber || "").trim();
  if (!IDENTIFICATION_DOCUMENT_VALUES.has(identificationType)) {
    errors.identificationType = "Identification Type is required.";
  }
  if (!value) {
    errors.idNumber = "ID Number is required.";
  } else {
    const minimum = identificationType === "school_id" ? 2 : 4;
    const maximum = identificationType === "school_id" ? 50 : 40;
    if (value.length < minimum || value.length > maximum || !/^[A-Za-z0-9 /-]+$/.test(value)) {
      errors.idNumber = "Enter the ID number exactly as shown using letters, numbers, spaces, hyphens, or slashes.";
    }
  }
  if (identificationType === "school_id" && !String(schoolInstitutionName || "").trim()) {
    errors.schoolInstitutionName = "School / Institution Name is required.";
  }
  if (!confirmedInformation) {
    errors.confirmedInformation = "Please confirm that the information provided is correct.";
  }
  return errors;
}
