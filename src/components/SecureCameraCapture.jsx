import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_BROWSER_CAMERA_ACCURACY_METERS,
  isAcceptableBrowserCameraAccuracy,
} from "../utils/cameraCapturePolicy";
import "../styles/secure-camera-capture.css";

const locationOptions = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

function locationError(error) {
  if (error?.code === 1) return "Location permission was denied. Allow precise location access and try again.";
  if (error?.code === 2) return "Your current location is unavailable. Move to an open area and try again.";
  if (error?.code === 3) return "Location acquisition timed out. Please try again.";
  return "A precise device location could not be obtained.";
}
function cameraError(error) {
  if (["NotAllowedError", "SecurityError"].includes(error?.name)) return "Camera access is denied or blocked. In Android Chrome, open Site settings for this page and allow Camera. In iOS Safari, open Settings > Safari > Camera (or this website's settings), allow access, then retry.";
  if (["NotFoundError", "DevicesNotFoundError"].includes(error?.name)) return "No camera is available on this device.";
  if (["NotReadableError", "TrackStartError"].includes(error?.name)) return "The camera is already in use or unavailable.";
  return "The camera could not be opened. Check browser permissions and try again.";
}

function locationPermissionError(error) {
  if (error?.code === 1) return "Location access is denied or blocked. In Android Chrome, open Site settings for this page and allow Location with Precise location enabled. In iOS Safari, open Settings > Privacy & Security > Location Services > Safari Websites, allow access, then retry.";
  return locationError(error);
}

async function permissionState(name) {
  if (!navigator.permissions?.query) return "unknown";
  try { return (await navigator.permissions.query({ name })).state; }
  catch { return "unknown"; }
}

const getLocation = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error("UNSUPPORTED_LOCATION"));
  navigator.geolocation.getCurrentPosition(resolve, reject, locationOptions);
});

async function digest(file) {
  const bytes = await file.arrayBuffer();
  const value = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("");
}

export default function SecureCameraCapture({ open, request, binding, onVerified, onDiagnostic, onViewLocation, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewRef = useRef("");
  const mountedRef = useRef(true);
  const requestRef = useRef(request);
  const bindingRef = useRef(binding);
  const diagnosticRef = useRef(onDiagnostic);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [location, setLocation] = useState(null);
  const [session, setSession] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [permissionSummary, setPermissionSummary] = useState({ camera: "unknown", location: "unknown" });

  useEffect(() => { requestRef.current = request; }, [request]);
  useEffect(() => { bindingRef.current = binding; }, [binding]);
  useEffect(() => { diagnosticRef.current = onDiagnostic; }, [onDiagnostic]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks?.().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const clearPreview = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = "";
    setPreview("");
    setFile(null);
  }, []);

  const begin = useCallback(async (selectedDeviceId = "") => {
    stopTracks();
    clearPreview();
    setError("");
    setStatus("requesting");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.isSecureContext) {
        throw Object.assign(new Error("Camera capture requires a secure browser connection."), { name: "UnsupportedError" });
      }
      const [cameraPermission, locationPermission] = await Promise.all([
        permissionState("camera"), permissionState("geolocation"),
      ]);
      setPermissionSummary({ camera: cameraPermission, location: locationPermission });
      if (locationPermission === "denied") throw { code: 1, permission: "location" };
      if (cameraPermission === "denied") throw Object.assign(new Error("Camera permission blocked"), { name: "NotAllowedError" });
      const position = await getLocation();
      if (!mountedRef.current) return;
      const nextLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude,
        accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp || Date.now()).toISOString() };
      setLocation(nextLocation);
      if (!isAcceptableBrowserCameraAccuracy(nextLocation.accuracy)) {
        diagnosticRef.current?.({
          status: "low_accuracy",
          location: nextLocation,
          message: `GPS accuracy is ${Math.round(nextLocation.accuracy || 0)} m; ${MAX_BROWSER_CAMERA_ACCURACY_METERS} m or better is required.`,
        });
        throw new Error(`GPS accuracy is ${Math.round(nextLocation.accuracy || 0)} m; ${MAX_BROWSER_CAMERA_ACCURACY_METERS} m or better is required.`);
      }
      const constraints = { video: selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId } }
        : { facingMode: { ideal: "environment" } }, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!mountedRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const response = await requestRef.current("/evidence-capture-sessions", {
        method: "POST", body: JSON.stringify(bindingRef.current),
      });
      setSession(response.data);
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const available = await navigator.mediaDevices.enumerateDevices();
      setDevices(available.filter(item => item.kind === "videoinput"));
      setDeviceId(stream.getVideoTracks()[0]?.getSettings?.().deviceId || selectedDeviceId);
      setStatus("ready");
    } catch (reason) {
      stopTracks();
      setStatus("error");
      setError(reason?.code ? locationPermissionError(reason) : reason?.name?.includes("Error") && reason.name !== "Error"
        ? cameraError(reason) : reason?.message || "Camera capture could not be started.");
    }
  }, [clearPreview, stopTracks]);

  useEffect(() => {
    mountedRef.current = true;
    if (open) {
      queueMicrotask(() => {
        if (!mountedRef.current) return;
        setStatus("idle");
        setError("");
        setLocation(null);
        setSession(null);
      });
    }
    return () => { mountedRef.current = false; stopTracks(); clearPreview(); };
  }, [open, begin, stopTracks, clearPreview]);

  async function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return setError("The camera preview is not ready.");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return setError("The captured frame could not be encoded.");
    const captured = new File([blob], `menro-camera-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    const url = URL.createObjectURL(captured);
    previewRef.current = url; setPreview(url); setFile(captured); stopTracks(); setStatus("captured");
  }

  async function verify() {
    setStatus("verifying"); setError("");
    try {
      const imageSha256 = await digest(file);
      const body = new FormData();
      body.append("photo", file); body.append("nonce", session.nonce);
      body.append("capturedAt", new Date(file.lastModified).toISOString());
      body.append("latitude", String(location.latitude)); body.append("longitude", String(location.longitude));
      body.append("accuracy", String(location.accuracy)); body.append("clientImageSha256", imageSha256);
      const response = await request(`/evidence-capture-sessions/${session.captureSessionId}/verify`, { method: "POST", body });
      stopTracks();
      onVerified({ file, descriptor: { source: "browser-camera", captureSessionId: session.captureSessionId,
        nonce: session.nonce, verificationId: response.data.verificationId, imageSha256: response.data.imageSha256 },
        location: response.data.location, previewUrl: preview });
    } catch (reason) {
      const code = reason?.code || "";
      const diagnosticStatus = code === "CAPTURE_LOCATION_INACCURATE" ? "low_accuracy"
        : code === "CAPTURE_LOCATION_INVALID" ? "invalid" : "outside_site";
      if (["CAPTURE_LOCATION_INACCURATE", "CAPTURE_LOCATION_INVALID", "CAPTURE_LOCATION_OUTSIDE_BULAN",
        "CAPTURE_LOCATION_OUTSIDE_SITE"].includes(code)) {
        diagnosticRef.current?.({ status: diagnosticStatus, location, message: reason.message,
          backendRejected: true, rejectionCode: code });
      }
      setStatus("captured"); setError(reason?.message || "Camera evidence verification failed.");
    }
  }

  if (!open) return null;
  return <div className="secure-camera-backdrop" role="dialog" aria-modal="true" aria-label="Secure camera capture">
    <div className="secure-camera-panel">
      <h3>Take Verified Photo</h3>
      <p className="secure-camera-status">{location
        ? `Location acquired · accuracy ${Math.round(location.accuracy)} m`
        : "Camera and precise location permission are required."}</p>
      {error && <div className="secure-camera-error" role="alert">{error}</div>}
      {status === "idle" && <div className="secure-camera-permission-explanation">
        <p>MENRO needs your camera to capture evidence and your precise location to verify it against the assigned planting site.</p>
        <p>Access is requested only after you continue. This capture keeps the location obtained for its session; opening the map does not request a new location.</p>
      </div>}
      {status !== "idle" && (preview ? <img className="secure-camera-preview" src={preview} alt="Captured evidence preview" />
        : <video className="secure-camera-preview" ref={videoRef} autoPlay muted playsInline />)}
      <div className="secure-camera-actions">
        {status === "idle" && <button type="button" onClick={() => begin(deviceId)}>Continue to Camera &amp; Location</button>}
        {status === "ready" && <button type="button" onClick={capture}>Capture</button>}
        {status === "captured" && <><button type="button" onClick={() => begin(deviceId)}>Retake</button>
          <button type="button" onClick={verify}>Verify &amp; Use Photo</button></>}
        {devices.length > 1 && status === "ready" && <button type="button" onClick={() => {
          const index = devices.findIndex(item => item.deviceId === deviceId);
          void begin(devices[(index + 1) % devices.length].deviceId);
        }}>Switch Camera</button>}
        {status === "error" && <button type="button" onClick={() => begin(deviceId)}>Retry</button>}
        {location && ["error", "captured"].includes(status) &&
          <button type="button" onClick={() => { stopTracks(); onViewLocation?.(); }}>View Detected Location</button>}
        <button type="button" onClick={() => { stopTracks(); clearPreview(); onCancel(); }}>Cancel</button>
      </div>
      {status === "error" && (permissionSummary.camera === "denied" || permissionSummary.location === "denied") &&
        <p className="secure-camera-help">After changing the browser or device permission, return here and tap Retry once.</p>}
      {status === "requesting" && <p>Requesting permissions…</p>}
      {status === "verifying" && <p>Verifying image and location…</p>}
    </div>
  </div>;
}
