export const USER_TYPES = [
  "Barangay Official",
  "Volunteer",
  "Organization Member",
  "Student / School Representative",
  "Government Employee",
  "Private Sector Representative",
  "Other",
];

export const BULAN_BARANGAYS = [
  "A.Bonifacio", "AbadSantos", "Aguinaldo", "Antipolo", "Beguin",
  "BenignoS.Aquino", "Bical", "Bonga", "Butag", "Cadandanan",
  "Calomagon", "Calpi", "Cocok-Cabitan", "Daganas", "Danao", "Dolos",
  "E.Quirino", "Fabrica", "G.DelPilar", "Gate", "Inararan", "J.Gerona",
  "J.P.Laurel", "Jamorawon", "Lajong", "Libertad", "M.Roxas",
  "Magsaysay", "Managanaga", "Marinab", "Montecalvario", "N.Roque",
  "Namo", "Nasuje", "Obrero", "Osmeña", "Otavi", "PadreDiaz", "Palale",
  "Quezon", "R.Gerona", "Recto", "Sagrada", "SanFrancisco", "SanIsidro",
  "SanJuanBag-O", "SanJuanDaan", "SanRafael", "SanRamon", "SanVicente",
  "SantaRemedios", "SantaTeresita", "Sigad", "Somagongsong", "Taromata",
  "ZoneIIIPoblacion", "ZoneIIPoblacion", "ZoneIPoblacion",
  "ZoneIVPoblacion", "ZoneVIIIPoblacion", "ZoneVIIPoblacion",
  "ZoneVIPoblacion", "ZoneVPoblacion",
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
    Other: ["Please Specify *", "Please specify your sector."],
  };
  const selected = fields[userType];
  return selected ? { kind: "detail", label: selected[0], error: selected[1] } : null;
}
