import { AMBIGUOUS_WRITE_MESSAGE, RequestTimeoutError } from "./requestTimeout.js";

// Photo submissions over slow mobile connections. A fixed total limit cancels uploads that are still progressing, so
// the limit is on inactivity instead: no progress for UPLOAD_STALL_MS, then RESPONSE_TIMEOUT_MS for MENRO to answer.
export const UPLOAD_STALL_MS = 60_000;
export const RESPONSE_TIMEOUT_MS = 120_000;
export const NOT_SAVED_MESSAGE = "The upload stopped before all photos were sent, so your report was not saved. Your entries and photos are kept. Check your connection and select Submit Report again.";
export const PROCESSING_MESSAGE = "MENRO received your report and is still processing the photos. Keep this form open and select Check Submission in a moment.";

// The request body was measurably incomplete, so MENRO cannot have saved it. Retrying keeps the same submission key.
export class UploadNotCompletedError extends Error {
  constructor(cause) {
    super(NOT_SAVED_MESSAGE, { cause });
    this.name = "UploadNotCompletedError";
    this.code = "UPLOAD_NOT_COMPLETED";
  }
}

// Only a measured partial upload is "not saved". Without any progress report nothing is proven, so it stays unknown.
export function sendSubmissionUpload(url, { method = "POST", headers = {}, body }, { onProgress, stallMs = UPLOAD_STALL_MS, responseMs = RESPONSE_TIMEOUT_MS,
  createRequest = () => new XMLHttpRequest(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  return new Promise((resolve, reject) => {
    const request = createRequest();
    let timer, loaded = 0, complete = false, settled = false;
    const settle = (finish, value) => { if (settled) return; settled = true; clearTimer(timer); finish(value); };
    const fail = cause => settle(reject, loaded > 0 && !complete ? new UploadNotCompletedError(cause) : new RequestTimeoutError(AMBIGUOUS_WRITE_MESSAGE, { ambiguous: true, cause }));
    const wait = ms => { clearTimer(timer); timer = setTimer(() => { fail(new Error("timeout")); request.abort(); }, ms); };
    const sent = () => { complete = true; wait(responseMs); onProgress?.({ phase: "processing", percent: 100 }); };
    request.open(method, url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = event => {
      if (settled || complete || !event.lengthComputable || !(event.total > 0)) return;
      loaded = event.loaded;
      if (loaded >= event.total) return sent();
      wait(stallMs);
      onProgress?.({ phase: "uploading", percent: Math.floor((loaded / event.total) * 100) });
    };
    request.upload.onload = () => { if (!settled && !complete) sent(); };
    request.onload = () => {
      const { status, responseText } = request;
      settle(resolve, { status, ok: status >= 200 && status < 300, json: async () => JSON.parse(responseText) });
    };
    request.onerror = () => fail(new Error("network"));
    request.onabort = () => fail(new Error("aborted"));
    wait(responseMs);
    request.send(body);
  });
}

// MENRO holds the submission and has not finished it: neither saved nor rejected yet.
export const isEvidenceStillProcessing = (status, body) => status === 202 || body?.code === "EVIDENCE_IN_PROGRESS";

// Mobile browsers can lose access to a chosen photo (moved, edited or permission expired). Checked only after a failure.
export async function findUnreadableFile(files = []) {
  for (const file of files) {
    try { await file.slice(0, 1).arrayBuffer(); await file.slice(Math.max(0, file.size - 1)).arrayBuffer(); }
    catch { return file; }
  }
  return null;
}
