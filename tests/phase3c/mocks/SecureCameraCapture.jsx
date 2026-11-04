export default function SecureCameraCapture({ open, request, binding, onVerified, onCancel }) {
  if (!open) return null;

  async function verifyFixturePhoto() {
    const session = await request("/evidence-capture-sessions", {
      method: "POST",
      body: JSON.stringify(binding),
    });
    const file = new File(["phase3c-fixture-photo"], "fixture.jpg", {
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
    <div role="dialog" aria-label="Secure camera capture">
      <button type="button" onClick={verifyFixturePhoto}>Verify fixture camera photo</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  );
}
