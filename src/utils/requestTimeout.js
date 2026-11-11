// Bounded waits for planting-report requests. A stalled sign-in, upload or
// list refresh must end in a clear error so loading states always recover.
export const AUTH_TIMEOUT_MS = 20_000;
export const READ_TIMEOUT_MS = 30_000;
export const WRITE_TIMEOUT_MS = 60_000;
export const UPLOAD_TIMEOUT_MS = 120_000;

export class RequestTimeoutError extends Error {
  constructor(message, { ambiguous = false, cause } = {}) {
    super(message, { cause });
    this.name = "RequestTimeoutError";
    this.code = "REQUEST_TIMEOUT";
    // true when a write may have reached MENRO before the wait ended, so the
    // outcome must be reconciled before anything is sent again.
    this.ambiguous = ambiguous;
  }
}

export const AUTH_TIMEOUT_MESSAGE = "Your sign-in could not be confirmed in time. Check your connection and try again.";
export const READ_TIMEOUT_MESSAGE = "The MENRO server did not respond in time. Please try again.";
export const AMBIGUOUS_WRITE_MESSAGE = "MENRO did not confirm the submission in time. It may already be saved. Keep this form unchanged and select Check Submission to confirm before anything is sent again.";

// Rejects with makeError() if the promise has not settled within timeoutMs.
// onTimeout runs first (for example to abort the underlying fetch).
export function withDeadline(promise, timeoutMs, makeError, { onTimeout, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer;
  const deadline = new Promise((_resolve, reject) => {
    timer = setTimer(() => { onTimeout?.(); reject(makeError()); }, timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), deadline]).finally(() => clearTimer(timer));
}

export const isWriteMethod = method => !["GET", "HEAD", "OPTIONS"].includes(String(method || "GET").toUpperCase());

// A write that timed out or lost its connection after it was sent has an
// unknown outcome. Failures before sending (sign-in) or with a server
// response are not ambiguous.
export function isAmbiguousWriteFailure(error) {
  return error?.ambiguous === true;
}

// A 502/504 that did not come from MENRO itself (no MENRO JSON body) is a
// hosting gateway giving up on the request: MENRO may still have processed a
// write, so its outcome is unknown, exactly like a timeout.
export function isGatewayWriteFailure(method, status, body) {
  return isWriteMethod(method) && (status === 502 || status === 504) && typeof body?.success !== "boolean";
}

// Server messages worth showing as they are: MENRO's own 503 answers name the
// unavailable service (for example evidence storage or upload maintenance).
// Other 5xx answers stay generic so internal failures are never exposed.
export function serverFailureMessage(status, body, fallback) {
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (status === 503 && message) return message;
  if (status >= 500) return fallback;
  return message || fallback;
}

// Runs fetch + body parsing under one deadline. The timer covers reading the
// body too, so a response that stalls mid-stream also recovers.
export async function fetchJsonWithDeadline(url, options = {}, { timeoutMs, parse = response => response.json().catch(() => null) } = {}) {
  const controller = new AbortController();
  const write = isWriteMethod(options.method);
  const run = (async () => {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await parse(response);
    if (isGatewayWriteFailure(options.method, response.status, body)) throw new RequestTimeoutError(AMBIGUOUS_WRITE_MESSAGE, { ambiguous: true });
    return { response, body };
  })();
  try {
    return await withDeadline(run, timeoutMs, () => new RequestTimeoutError(write ? AMBIGUOUS_WRITE_MESSAGE : READ_TIMEOUT_MESSAGE, { ambiguous: write }), { onTimeout: () => controller.abort() });
  } catch (error) {
    if (error instanceof RequestTimeoutError) { run.catch(() => {}); throw error; }
    // A dropped connection during a write: the server may have processed it.
    if (write && error instanceof TypeError) throw new RequestTimeoutError(AMBIGUOUS_WRITE_MESSAGE, { ambiguous: true, cause: error });
    if (error instanceof TypeError) throw new Error("The MENRO server could not be reached. Check your connection and try again.", { cause: error });
    throw error;
  }
}
