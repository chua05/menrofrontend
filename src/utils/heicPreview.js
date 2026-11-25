// Browsers other than Safari cannot show HEIC. This makes a picture for the screen only: the original file is what is verified,
// uploaded and stored. The decoder is loaded only when a HEIC photo has to be shown.
const MAX_PIXELS = 40_000_000;
const MAX_EDGE = 1600;

export const isHeicBlob = blob => ["image/heic", "image/heif"].includes(blob?.type) ||
  /\.(heic|heif)$/i.test(blob?.name || "");

export async function heicToPreviewBlob(blob) {
  let decoder;
  try {
    const module = await import("libheif-js/wasm-bundle");
    decoder = module.default || module;
  } catch { throw Object.assign(new Error("The HEIC viewer could not be loaded."), { code: "HEIC_VIEWER_UNAVAILABLE" }); }
  const images = new decoder.HeifDecoder().decode(new Uint8Array(await blob.arrayBuffer()));
  const image = images[0];
  if (!image) throw Object.assign(new Error("The HEIC photo could not be decoded."), { code: "HEIC_UNREADABLE" });
  try {
    const width = image.get_width(), height = image.get_height();
    if (!width || !height || width * height > MAX_PIXELS) throw Object.assign(new Error("The HEIC photo is too large to show."), { code: "HEIC_UNREADABLE" });
    const full = document.createElement("canvas");
    full.width = width; full.height = height;
    const context = full.getContext("2d"), pixels = context.createImageData(width, height);
    await new Promise((resolve, reject) => image.display(pixels, data => data ? resolve()
      : reject(Object.assign(new Error("The HEIC photo could not be decoded."), { code: "HEIC_UNREADABLE" }))));
    context.putImageData(pixels, 0, 0);
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height)), small = document.createElement("canvas");
    small.width = Math.round(width * scale); small.height = Math.round(height * scale);
    small.getContext("2d").drawImage(full, 0, 0, small.width, small.height);
    full.width = full.height = 0;
    const preview = await new Promise(resolve => small.toBlob(resolve, "image/jpeg", 0.85));
    if (!preview) throw Object.assign(new Error("The HEIC photo could not be shown."), { code: "HEIC_UNREADABLE" });
    return preview;
  } finally { for (const entry of images) entry.free?.(); }
}
// A blob the current browser can show: HEIC is converted, anything else is returned unchanged.
export const displayableBlob = async blob => (isHeicBlob(blob) ? heicToPreviewBlob(blob) : blob);
