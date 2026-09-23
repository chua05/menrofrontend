export const USER_TYPES = [
  "Barangay Official",
  "Volunteer",
  "Organization Member",
  "Student / School Representative",
  "Government Employee",
  "Private Sector Representative",
  "Other",
];

export const JUBAN_BARANGAYS = [
  "Añog", "Aroroy", "Bacolod", "Binanuahan", "Biriran", "Buraburan",
  "Calateo", "Calmayon", "Caruhayon", "Catanagan", "Catanusan", "Cogon",
  "Embarcadero", "Guruyan", "Lajong", "Maalo", "North Poblacion",
  "South Poblacion", "Puting Sapa", "Rangas", "Sablayan", "Sipaya",
  "Taboc", "Tinago", "Tughan",
];

export function userTypeField(userType) {
  if (["Barangay Official", "Volunteer"].includes(userType)) {
    return { kind: "barangay", label: "Barangay *", error: "Please select your barangay." };
  }
  const fields = {
    "Organization Member": ["Organization Name *", "Please enter your organization name."],
    "Student / School Representative": ["School / Institution Name *", "Please enter your school or institution name."],
    "Government Employee": ["Office Name *", "Please enter your office name."],
    "Private Sector Representative": ["Company / Organization Name *", "Please enter your company or organization name."],
    Other: ["Please Specify *", "Please specify your user type."],
  };
  const selected = fields[userType];
  return selected ? { kind: "detail", label: selected[0], error: selected[1] } : null;
}
