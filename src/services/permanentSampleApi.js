import { authenticatedFetch } from "./authenticatedApi";

export async function sampleRequest(path, options) {
  const response = await authenticatedFetch(path, options);
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw Object.assign(new Error(payload.message || `Request failed (${response.status}). Refresh and try again.`), { status: response.status });
  }
  return payload.data;
}
