export const ID_MAX_BYTES = 5 * 1024 * 1024;
export const ID_MAX_EDGE = 2000;
export const ID_JPEG_QUALITY = 0.85;

export const ID_MSG_UNSUPPORTED_TYPE = "Invalid file type. Please upload a JPG, PNG, WebP, HEIC or PDF file.";
export const ID_MSG_HEIC_FAIL = "This photo format isn't supported. Please take a new photo or choose a JPG/PNG.";
export const ID_MSG_TOO_LARGE = "File size exceeds 5 MB limit. This photo is too large — retake it or choose a smaller one.";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "image/heic",
  "image/heif",
]);
const ALLOWED_EXT = /\.(jpe?g|png|webp|pdf|heic|heif)$/i;

export function isAllowedIdFile(file: { name: string; type: string }): boolean {
  return ALLOWED_MIME.has((file.type || "").toLowerCase()) || ALLOWED_EXT.test(file.name);
}

export function isHeicFile(file: { name: string; type: string }): boolean {
  return /^image\/hei[cf]$/i.test(file.type || "") || /\.(heic|heif)$/i.test(file.name);
}

export function isPdfFile(file: { name: string; type: string }): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function scaleToFit(width: number, height: number, maxEdge = ID_MAX_EDGE) {
  const long = Math.max(width, height);
  if (long <= maxEdge) return { width, height };
  const r = maxEdge / long;
  return { width: Math.round(width * r), height: Math.round(height * r) };
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(file);
    return { source: bmp, width: bmp.width, height: bmp.height };
  }
  // jsdom has no image decoder for blob: URLs, so Image.onload/onerror never fire.
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    throw new Error("decode unavailable");
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const timer = setTimeout(() => reject(new Error("decode timeout")), 5000);
      el.onload = () => {
        clearTimeout(timer);
        resolve(el);
      };
      el.onerror = () => {
        clearTimeout(timer);
        reject(new Error("decode failed"));
      };
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type PrepareIdResult = { ok: true; file: File } | { ok: false; error: string };

/**
 * Validates an ID upload and, for images, resizes/recompresses to JPEG via canvas.
 * PDFs are returned untouched.
 */
export async function prepareIdFile(file: File): Promise<PrepareIdResult> {
  if (!isAllowedIdFile(file)) return { ok: false, error: ID_MSG_UNSUPPORTED_TYPE };

  if (isPdfFile(file)) {
    return file.size > ID_MAX_BYTES ? { ok: false, error: ID_MSG_TOO_LARGE } : { ok: true, file };
  }

  const heic = isHeicFile(file);
  let out: File = file;
  try {
    const { source, width, height } = await decode(file);
    const dims = scaleToFit(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(source, 0, 0, dims.width, dims.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", ID_JPEG_QUALITY)
    );
    if (!blob) throw new Error("encode failed");
    // Keep the original if it is already smaller and needs no conversion.
    if (heic || blob.size < file.size) {
      const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      out = new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
    }
  } catch {
    if (heic) return { ok: false, error: ID_MSG_HEIC_FAIL };
    // Non-HEIC: fall back to the original file and let the size check decide.
  }

  if (out.size > ID_MAX_BYTES) return { ok: false, error: ID_MSG_TOO_LARGE };
  return { ok: true, file: out };
}
