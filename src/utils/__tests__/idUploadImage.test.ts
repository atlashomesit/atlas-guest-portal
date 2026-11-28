import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isAllowedIdFile,
  scaleToFit,
  prepareIdFile,
  ID_MSG_HEIC_FAIL,
  ID_MSG_TOO_LARGE,
} from "../idUploadImage";

function mockCanvas(blobSize: number) {
  const drawImage = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage }),
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob([new Uint8Array(blobSize)])),
  };
  vi.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLElement);
  return canvas;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("idUploadImage", () => {
  it("accepts by MIME or extension", () => {
    expect(isAllowedIdFile({ name: "x", type: "image/webp" })).toBe(true);
    expect(isAllowedIdFile({ name: "IMG.HEIC", type: "" })).toBe(true);
    expect(isAllowedIdFile({ name: "a.gif", type: "image/gif" })).toBe(false);
  });

  it("scales long edge to 2000", () => {
    expect(scaleToFit(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(scaleToFit(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("compresses a large photo under the cap", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ width: 4000, height: 3000 }));
    const canvas = mockCanvas(1000);
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "p.jpg", { type: "image/jpeg" });
    const res = await prepareIdFile(big);
    expect(res.ok).toBe(true);
    expect(canvas.width).toBe(2000);
    if (res.ok) expect(res.file.size).toBe(1000);
  });

  it("leaves PDFs untouched", async () => {
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    const res = await prepareIdFile(pdf);
    expect(res.ok && res.file === pdf).toBe(true);
  });

  it("shows actionable message when HEIC cannot be decoded", async () => {
    vi.stubGlobal("createImageBitmap", async () => {
      throw new Error("nope");
    });
    const res = await prepareIdFile(new File(["x"], "a.heic", { type: "image/heic" }));
    expect(res).toEqual({ ok: false, error: ID_MSG_HEIC_FAIL });
  });

  it("rejects still-too-large result", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ width: 100, height: 100 }));
    mockCanvas(6 * 1024 * 1024);
    const big = new File([new Uint8Array(7 * 1024 * 1024)], "p.png", { type: "image/png" });
    expect(await prepareIdFile(big)).toEqual({ ok: false, error: ID_MSG_TOO_LARGE });
  });
});
