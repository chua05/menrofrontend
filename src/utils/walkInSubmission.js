export function isAmbiguousSubmissionFailure(error, online = globalThis.navigator?.onLine) {
  if (error?.name === "AbortError") return true;
  if (online === false || error instanceof TypeError) return true;
  return !Number.isInteger(error?.status);
}

export function findPersistedSubmission(payload, clientSubmissionId) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.requests)
      ? payload.requests
      : Array.isArray(payload?.items)
        ? payload.items
        : [];
  return rows.find((row) => row?.clientSubmissionId === clientSubmissionId) || null;
}

export function submissionFailureMessage(error, online = globalThis.navigator?.onLine) {
  if (error?.name === "AbortError") {
    return "The request is taking longer than expected. Its status could not be confirmed. Your entries are preserved; check My Requests before retrying.";
  }
  if (error?.status === 401) return "Your session has expired. Please sign in again and retry.";
  if (error?.status === 403) return "Your account is not authorized to submit this request.";
  if (error?.status === 503) {
    return `${error.message || "Request submission is temporarily unavailable."} Your entries are preserved; please try again later.`;
  }
  if (online === false || error instanceof TypeError) {
    return "Unable to reach MENRO. Your entries are preserved; check My Requests before retrying.";
  }
  return error?.message || "An unexpected error prevented the request from being submitted. Your entries are preserved.";
}
