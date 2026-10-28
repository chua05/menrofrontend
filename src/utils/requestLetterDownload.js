import { authenticatedFetch } from "../services/authenticatedApi";

function safeDownloadName(value) {
  const fallback = "request-letter";
  const printable = [...String(value || fallback)]
    .map(character => character.charCodeAt(0) < 32 || "\\/:*?\"<>|".includes(character) ? "_" : character)
    .join("");
  return printable.slice(0, 180) || fallback;
}

export function hasPrivateRequestLetter(request) {
  return request?.requestLetter?.storageStatus === "private_v1";
}

export async function downloadPrivateRequestLetter(request) {
  if (!request?.id || !hasPrivateRequestLetter(request)) throw new Error("No stored request letter is available.");
  const response = await authenticatedFetch(`/seedling-requests/${encodeURIComponent(request.id)}/request-letter`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Request letter could not be downloaded.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeDownloadName(request.requestLetter.originalName);
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  try { anchor.click(); } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
