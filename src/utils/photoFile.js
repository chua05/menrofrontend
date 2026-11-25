import { captureTime, parsePhotoMetadata } from "./photoMetadata.js";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;
export const PHOTO_FORMATS = "JPEG, HEIC, PNG or WebP";
export const UNSUPPORTED_PHOTO_MESSAGE = `The photo format could not be processed. Upload the original ${PHOTO_FORMATS} photo.`;

// Android's photo picker, used for image-only choosers, blanks the GPS of the photos it returns. Without the filter Android offers
// the file chooser, which returns the original file. Formats are checked after selection either way.
export function photoAccept(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  return /Android/i.test(userAgent) ? undefined : ".jpg,.jpeg,.png,.webp,.heic,.heif,image/heic,image/heif";
}
// Some phones and desktops leave the type of a HEIC file empty.
export const isSupportedPhotoFile = file => TYPES.has(file?.type) ||
  ["", "application/octet-stream"].includes(file?.type ?? "") && EXTENSIONS.test(file?.name || "");

// The whole original is read at once; a partial read can miss metadata stored late in the file.
export async function readPhoto(file) {
  const photo = parsePhotoMetadata(await file.arrayBuffer());
  return { ...photo, captured: captureTime(photo) };
}
export function photoMetadataProblem(photo) {
  if (photo.metadataStatus === "unsupported") return { status: "unsupported", label: "Verification Failed — Unsupported Format", message: UNSUPPORTED_PHOTO_MESSAGE };
  if (photo.gps.status === "valid") return null;
  if (photo.metadataStatus === "malformed") return { status: "unparseable", label: "Verification Failed — Metadata Unreadable", message: "The photo metadata could not be read. Please use the original geotagged photo and try again." };
  if (photo.gps.status === "unparseable") return { status: "unparseable", label: "Verification Failed — GPS Metadata Unreadable", message: "Your photo contains GPS metadata, but the coordinates could not be read correctly." };
  if (photo.gps.status === "invalid") return { status: "invalid", label: "Verification Failed — Invalid GPS Coordinates", message: "Your photo contains invalid GPS coordinates. Please upload an original geotagged photo with valid location information." };
  return { status: "missing", label: "Verification Failed — No GPS Metadata", message: photo.gps.removed
    ? "This photo does not contain GPS coordinates. The phone removed them when the photo was shared or selected. Please upload the original file, or use Take Photo."
    : "This photo does not contain GPS coordinates. Please upload an original geotagged photo, or use Take Photo." };
}
