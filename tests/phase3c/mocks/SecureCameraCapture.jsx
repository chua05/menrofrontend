export default function SecureCameraCapture({ open, request, binding, onVerified, onCancel }) {
  if (!open) return null;

  async function verifyFixturePhoto() {
    const session = await request("/evidence-capture-sessions", {
      method: "POST",
      body: JSON.stringify(binding),
    });
    const canvas = document.createElement("canvas"); canvas.width = 8; canvas.height = 8;
    const context = canvas.getContext("2d"); context.fillStyle = "#145b3a"; context.fillRect(0, 0, 8, 8);
    const jpeg = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg"));
    const file = new File([jpeg], "fixture.jpg", {
      type: "image/jpeg",
      lastModified: 1,
    });
    const verified = await request(
      `/evidence-capture-sessions/${session.data.captureSessionId}/verify`,
      { method: "POST", body: new FormData() }
    );
    onVerified({
      file,
      descriptor: {
        source: "browser-camera",
        captureSessionId: session.data.captureSessionId,
        nonce: session.data.nonce,
        verificationId: verified.data.verificationId,
        imageSha256: verified.data.imageSha256,
      },
      previewUrl: "data:image/jpeg;base64,cGhhc2UzYy1maXh0dXJl",
      location: verified.data.location,
    });
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Secure camera capture">
      <button type="button" onClick={verifyFixturePhoto}>Verify fixture camera photo</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  );
}
