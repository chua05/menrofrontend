// Mirrors menroBK/src/utils/requesterDetails.util.js.
const OTHER_SECTOR = "Other (please specify)";
const LEGACY_SCHOOL_SECTOR = "School / Student";
const ORGANIZATION_KEY = "organizationName";

const DETAIL_FIELDS = Object.freeze({
  "Barangay Official": { key: "positionInBarangay", label: "Position in Barangay" },
  "Student (Individual)": { key: "schoolName", label: "School Name" },
  "School Organization Representative": { key: ORGANIZATION_KEY, label: "School / Organization Name" },
  "Private Sector / Business": { key: ORGANIZATION_KEY, label: "Business / Company Name" },
  "Civic Organization / NGO": { key: ORGANIZATION_KEY, label: "Organization Name" },
  "Government Agency": { key: ORGANIZATION_KEY, label: "Government Agency / Office Name" },
  [OTHER_SECTOR]: { key: "sectorOther", label: "Specify Requester Type" },
});

export const REQUESTER_DETAIL_RESET = Object.freeze({ positionInBarangay: "", schoolName: "", organizationName: "", sectorOther: "" });

export function getRequesterDetailField(sector, requestingAs) {
  if (sector === LEGACY_SCHOOL_SECTOR) {
    return requestingAs === "group" ? { key: ORGANIZATION_KEY, label: "School / Organization Name" } : null;
  }
  return DETAIL_FIELDS[sector] || null;
}

export function keepOnlyRequesterDetail(values, sector, requestingAs) {
  const kept = { ...REQUESTER_DETAIL_RESET };
  const field = getRequesterDetailField(sector, requestingAs);
  if (field) kept[field.key] = String(values[field.key] ?? "").trim();
  // Saved Other / Group requests still carry the organization they were filed under.
  if (sector === OTHER_SECTOR && requestingAs === "group") kept[ORGANIZATION_KEY] = String(values[ORGANIZATION_KEY] ?? "").trim();
  return kept;
}
