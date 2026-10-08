import { auth } from "../firebase/config";

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

let backendSessionRequest = null;
const BACKEND_SESSION_TIMEOUT_MS = 15_000;

const now = () => performance.now();

const wait = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const backendErrorCode = (status) => {
  if (status === 401) return "BACKEND_UNAUTHORIZED";
  if (status === 403) return "BACKEND_FORBIDDEN";
  if (status === 429) return "BACKEND_RATE_LIMITED";
  if (status >= 500) return "BACKEND_SERVER_ERROR";
  return "BACKEND_REJECTED";
};

const parseServerTiming = (value = "") => Object.fromEntries(
  value.split(",").map((entry) => {
    const [name, ...parameters] = entry.trim().split(";");
    const duration = parameters
      .map((parameter) => parameter.trim())
      .find((parameter) => parameter.startsWith("dur="));
    return [name, Number(duration?.slice(4)) || 0];
  }).filter(([name]) => name),
);

async function requestBackendSession(firebaseUser) {
  const startedAt = now();
  const tokenStartedAt = now();
  const token = await firebaseUser.getIdToken();
  const tokenDurationMs = now() - tokenStartedAt;
  let response;
  let backendStartedAt;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      BACKEND_SESSION_TIMEOUT_MS,
    );
    try {
      backendStartedAt = now();
      response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      break;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new MenroApiError(
          "MENRO authentication timed out. Please try again.",
          { code: "BACKEND_TIMEOUT", cause: error }
        );
      }
      if (attempt === 0 && navigator.onLine !== false) {
        await wait(750);
        continue;
      }
      throw new MenroApiError(
        "The MENRO server could not be reached.",
        { code: "BACKEND_UNAVAILABLE", cause: error }
      );
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  const backendDurationMs = now() - backendStartedAt;
  const serverTiming = parseServerTiming(response.headers.get("Server-Timing") || "");
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
  return {
    profile: payload.data,
    timing: {
      tokenDurationMs,
      backendDurationMs,
      totalVerificationDurationMs: now() - startedAt,
      firebaseTokenVerificationMs: serverTiming["firebase-token"] || 0,
      profileLookupMs: serverTiming["profile-read"] || 0,
      profileSyncMs: serverTiming["profile-sync"] || 0,
    },
  };
}

export async function verifyMenroSession(
  firebaseUser = auth.currentUser,
  { onTiming } = {},
) {
  if (!firebaseUser) {
    throw new MenroApiError(
      "Firebase authentication is required.", {
        code: "FIREBASE_SESSION_MISSING",
        status: 401,
      }
    );
  }

  if (backendSessionRequest?.uid === firebaseUser.uid) {
    const result = await backendSessionRequest.promise;
    onTiming?.(result.timing);
    return result.profile;
  }

  const request = requestBackendSession(firebaseUser);
  backendSessionRequest = { uid: firebaseUser.uid, promise: request };
  request.catch(() => {
    if (backendSessionRequest?.promise === request) backendSessionRequest = null;
  });
  const result = await request;
  onTiming?.(result.timing);
  return result.profile;
}

export function resetMenroSessionRequest() {
  backendSessionRequest = null;
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
