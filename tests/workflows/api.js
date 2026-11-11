export const API_BASE_URL = "http://127.0.0.1:5184/api";
export class MenroApiError extends Error {}
export const getAuthToken = async () => "workflow-test-token";
export const resetMenroSessionRequest = () => {};
export const verifyMenroSession = async () => ({ uid: "test-participant", role: "participant", fullName: "Workflow User" });
export function authenticatedFetch(path, options = {}) {
  const url = path.startsWith("/") ? `${API_BASE_URL}${path}` : path;
  if (new URL(url).origin !== "http://127.0.0.1:5184") throw new Error("Unapproved test API origin");
  return fetch(url, { ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers } });
}
export const publicApiFetch = authenticatedFetch;
import { fetchJsonWithDeadline, READ_TIMEOUT_MS } from "../../src/utils/requestTimeout.js";

// Keep the real response deadline used by the Staff form, at the same isolated
// network boundary as the existing fetch fixture.
export function authenticatedJson(path, options = {}, { timeoutMs = READ_TIMEOUT_MS } = {}) {
  const url = path.startsWith("/") ? `${API_BASE_URL}${path}` : path;
  if (new URL(url).origin !== "http://127.0.0.1:5184") throw new Error("Unapproved test API origin");
  return fetchJsonWithDeadline(url, { ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers } }, { timeoutMs });
}
