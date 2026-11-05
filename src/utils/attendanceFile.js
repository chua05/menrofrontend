export const ATTENDANCE_MAX_BYTES = 10 * 1024 * 1024;
export function attendanceFileError(file) {
  if (!file) return "";
  const types = { "application/pdf": /\.pdf$/i, "image/jpeg": /\.jpe?g$/i, "image/png": /\.png$/i };
  return !types[file.type]?.test(file.name) || !Number.isFinite(file.size) || file.size <= 0 || file.size > ATTENDANCE_MAX_BYTES
    ? "Choose one PDF, JPEG or PNG file not larger than 10 MB." : "";
}
