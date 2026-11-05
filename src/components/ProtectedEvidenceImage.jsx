import { useEffect, useState } from "react";
import { auth } from "../firebase/config";
import { privateImageRequest } from "../utils/privateImageRequests";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const messages = {
  forbidden: "You don't have permission to view this photo.",
  missing: "Photo is unavailable.",
  session: "Your session has expired. Please sign in again.",
  failed: "Unable to load the photo. Please try again.",
};

async function authenticatedImageRequest(endpoint, forceRefresh, signal) {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return { status: 401 };
  const token = await firebaseUser.getIdToken(forceRefresh);
  return fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
}

export default function ProtectedEvidenceImage({
  endpoint,
  alt,
  className,
  showOpenButton = false,
  openButtonClassName,
  openButtonContent = "View Full Size",
}) {
  const [state, setState] = useState({ status: "loading", url: "" });

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    async function load() {
      setState({ status: "loading", url: "" });
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) { setState({ status: "session", url: "" }); return; }
        const response = await privateImageRequest(uid, endpoint, async () => {
          if (auth.currentUser?.uid !== uid) return { status: 401 };
          const signal = AbortSignal.timeout(30000);
          let result = await authenticatedImageRequest(endpoint, false, signal);
          if (result.status === 401 && auth.currentUser?.uid === uid) result = await authenticatedImageRequest(endpoint, true, signal);
          const blob = result.ok ? await result.blob() : null;
          return auth.currentUser?.uid === uid ? { status: result.status, ok: result.ok, blob } : { status: 401 };
        });
        if (!active) return;

        if (response.status === 403) {
          setState({ status: "forbidden", url: "" });
          return;
        }
        if (response.status === 401) {
          setState({ status: "session", url: "" });
          return;
        }
        if (response.status === 404) {
          setState({ status: "missing", url: "" });
          return;
        }
        if (!response.ok) {
          setState({ status: "failed", url: "" });
          return;
        }

        objectUrl = URL.createObjectURL(response.blob);
        setState({ status: "ready", url: objectUrl });
      } catch (error) {
        if (active && error.name !== "AbortError") {
          setState({ status: "failed", url: "" });
        }
      }
    }

    load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [endpoint]);

  if (state.status === "loading") {
    return <div className="protected-evidence-state">Loading photo…</div>;
  }

  if (state.status !== "ready") {
    return (
      <div className="protected-evidence-state is-error" role="status">
        {messages[state.status] || messages.failed}
      </div>
    );
  }

  return (
    <>
      <img src={state.url} alt={alt} className={className} />
      {showOpenButton && (
        <button
          type="button"
          className={openButtonClassName}
          onClick={() => window.open(state.url, "_blank", "noopener,noreferrer")}
        >
          {openButtonContent}
        </button>
      )}
    </>
  );
}
