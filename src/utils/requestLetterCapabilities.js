export function requestLetterClientGateEnabled(env = import.meta.env) {
  return env?.VITE_REQUEST_LETTER_STORAGE_ENABLED === "true";
}

export function resolveSecureRequestLetterCapability({ clientEnabled, backendCapabilities }) {
  return clientEnabled === true &&
    backendCapabilities?.requestLetterStorage?.uploadEnabled === true;
}

export function legacyRequestLetterMetadata(file) {
  if (!file) return null;
  return {
    name: file.name || "Request letter",
    type: file.type || "",
    size: Number(file.size || 0),
  };
}
