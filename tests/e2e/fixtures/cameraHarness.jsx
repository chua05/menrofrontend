/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import SecureCameraCapture from "../../../src/components/SecureCameraCapture";

function Harness() {
  const [open, setOpen] = useState(true);
  async function request(path) {
    window.cameraRequests = [...(window.cameraRequests || []), path];
    if (path.endsWith("/verify")) return { data: { verificationId: "verification-1",
      imageSha256: "a".repeat(64), location: { latitude: 12.671, longitude: 123.875,
        accuracy: window.acceptanceAccuracy } } };
    return { data: { captureSessionId: "session-1", nonce: "nonce-1",
      expiresAt: new Date(Date.now() + 300000).toISOString() } };
  }
  return <SecureCameraCapture open={open} request={request}
    binding={{ workflow: "planting-report", siteId: "site-1", eventId: "event-1", distributionId: "distribution-1" }}
    onVerified={value => { window.verifiedCapture = value; setOpen(false); }}
    onCancel={() => { window.cameraCancelled = true; setOpen(false); }} />;
}

createRoot(document.getElementById("root")).render(<Harness />);
