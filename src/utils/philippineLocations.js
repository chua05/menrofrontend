import {
  getAllMunicipalities,
  getAllProvinces,
  getMunicipalitiesByProvince,
  getBarangaysByMunicipality,
} from "@aivangogh/ph-address";
import { BULAN_BARANGAYS } from "./userTypes.js";

const METRO_MANILA = {
  name: "Metro Manila",
  psgcCode: "1300000000",
};

const provinces = [...getAllProvinces(), METRO_MANILA]
  .sort((left, right) => left.name.localeCompare(right.name));

const municipalities = getAllMunicipalities();

export function getPhilippineProvinces() {
  return provinces;
}

export function getMunicipalitiesForProvince(provinceName) {
  const province = provinces.find((entry) => entry.name === provinceName);
  if (!province) return [];
  if (province.psgcCode === METRO_MANILA.psgcCode) {
    return municipalities
      .filter((entry) => entry.provinceCode === METRO_MANILA.psgcCode)
      .sort((left, right) => left.name.localeCompare(right.name));
  }
  return getMunicipalitiesByProvince(province.psgcCode);
}

export function getBarangaysForLocation(provinceName, municipalityName) {
  if (provinceName === "Sorsogon" && municipalityName === "Bulan") return BULAN_BARANGAYS;
  const municipality = getMunicipalitiesForProvince(provinceName).find(row => row.name === municipalityName);
  return municipality ? getBarangaysByMunicipality(municipality.psgcCode).map(row => row.name).sort((a, b) => a.localeCompare(b)) : [];
}
