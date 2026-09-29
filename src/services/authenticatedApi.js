import { auth } from "../firebase/config";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
const localApiUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(
  configuredApiUrl || "",
);

export const API_BASE_URL =
  import.meta.env.PROD && (!configuredApiUrl || localApiUrl)
    ? "https://menrobk-1.onrender.com/api"
    : configuredApiUrl || "http://localhost:5000/api";

export async function getAuthToken(forceRefresh = false) {
  if (typeof auth.authStateReady === "function") await auth.authStateReady();
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) {
    throw new Error("Your session has expired. Please sign in again.");
  }
  return firebaseUser.getIdToken(forceRefresh);
}

export async function authenticatedFetch(path, options = {}, forceRefresh = false) {
  const token = await getAuthToken(forceRefresh);
  const response = await fetch(path.startsWith("http") ? path : `${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 && !forceRefresh) {
    return authenticatedFetch(path, options, true);
  }
  return response;
}
