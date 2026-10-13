const SERVICE_WORKER_VERSION = "menro-basic-pwa-v1";

self.addEventListener("install", () => {
  // This basic PWA intentionally precaches nothing. Authenticated and
  // operational data must always come from the network.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data === "MENRO_PWA_VERSION") {
    event.source?.postMessage({ type: "MENRO_PWA_VERSION", version: SERVICE_WORKER_VERSION });
  }
});
