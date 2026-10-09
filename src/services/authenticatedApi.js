import { auth } from "../firebase/config";
import { createAuthSessionRequest } from "./authSessionRequest";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
const localApiUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(
  configuredApiUrl || "",
);

export const API_BASE_URL =
  import.meta.env.PROD && (!configuredApiUrl || localApiUrl)
    ? "https://menrobk-1.onrender.com/api"
    : configuredApiUrl || "http://localhost:5000/api";

export class MenroApiError extends Error {
  constructor(message, { code = "BACKEND_ERROR", status = 0, cause } = {}) {
    super(message, { cause });
    this.name = "MenroApiError";
    this.code = code;
    this.status = status;
  }
}

const wait = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const backendErrorCode = (status) => {
  if (status === 401) return "BACKEND_UNAUTHORIZED";
  if (status === 403) return "BACKEND_FORBIDDEN";
  if (status === 429) return "BACKEND_RATE_LIMITED";
  if (status >= 500) return "BACKEND_SERVER_ERROR";
  return "BACKEND_REJECTED";
};

async function requestBackendSession(firebaseUser) {
  const token = await firebaseUser.getIdToken();
  let response;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      break;
    } catch (error) {
      if (attempt === 0 && navigator.onLine !== false) {
        await wait(750);
        continue;
      }
      throw new MenroApiError(
        "The MENRO server could not be reached.",
        { code: "BACKEND_UNAVAILABLE", cause: error }
      );
    }
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new MenroApiError(
      payload?.message || "MENRO authentication was rejected.",
      { code: backendErrorCode(response.status), status: response.status }
    );
  }
  if (!payload?.data) {
    throw new MenroApiError("The MENRO server returned an invalid authentication response.");
  }
  return payload.data;
}

const authSessionRequest = createAuthSessionRequest(requestBackendSession);

export async function verifyMenroSession(firebaseUser = auth.currentUser) {
  if (!firebaseUser) {
    throw new MenroApiError(
      "Firebase authentication is required.", {
        code: "FIREBASE_SESSION_MISSING",
        status: 401,
      }
    );
  }

  return authSessionRequest.verify(firebaseUser);
}

export function resetMenroSessionRequest() {
  authSessionRequest.reset();
}

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

export async function publicApiFetch(path, options = {}) {
  return fetch(path.startsWith("http") ? path : `${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
}
