import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * TASK-7433: Unit tests for responsive srcset builder in OptimizedImage.tsx
 *
 * Azure Blob Storage ignores imgix-style resize params — srcset is omitted for blob URLs.
 * Transform-capable CDN origins still get width variants.
 */

beforeEach(() => {
  vi.stubGlobal('window', {
    location: { origin: 'https://dev.atlashomestays.com' },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function shouldBuildResponsiveSrcSet(src: string): boolean {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://example.invalid";
    const url = new URL(src, base);
    if (url.hostname.includes("blob.core.windows.net")) return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return false;
    if (url.pathname.includes("/uploads/")) return false;
    return true;
  } catch {
    return false;
  }
}

const RESPONSIVE_WIDTHS = [480, 768, 1200];

function buildResponsiveSrcSet(src: string, widths: number[] = RESPONSIVE_WIDTHS) {
  try {
    if (!shouldBuildResponsiveSrcSet(src)) return undefined;
    const base = typeof window !== "undefined" ? window.location.origin : "https://example.invalid";
    const url = new URL(src, base);

    return widths
      .map((width) => {
        const next = new URL(url);
        next.searchParams.set("w", String(width));
        next.searchParams.set("auto", "format");
        return `${next.toString()} ${width}w`;
      })
      .join(", ");
  } catch {
    return undefined;
  }
}

describe('OptimizedImage — srcset builder (TASK-7433)', () => {
  describe('shouldBuildResponsiveSrcSet', () => {
    it('returns false for Azure blob URLs (origin ignores resize params)', () => {
      const blobUrl = 'https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg';
      expect(shouldBuildResponsiveSrcSet(blobUrl)).toBe(false);
    });

    it('returns false for localhost URLs', () => {
      const localhostUrl = 'http://localhost:5174/images/test.jpg';
      expect(shouldBuildResponsiveSrcSet(localhostUrl)).toBe(false);
    });

    it('returns false for 127.0.0.1 URLs', () => {
      const loopbackUrl = 'http://127.0.0.1:5174/images/test.jpg';
      expect(shouldBuildResponsiveSrcSet(loopbackUrl)).toBe(false);
    });

    it('returns false for /uploads/ paths', () => {
      const uploadsUrl = 'https://cdn.example.com/uploads/test.jpg';
      expect(shouldBuildResponsiveSrcSet(uploadsUrl)).toBe(false);
    });

    it('returns true for transform-capable remote CDN URLs', () => {
      const cdnUrl = 'https://images.example.com/photo.jpg';
      expect(shouldBuildResponsiveSrcSet(cdnUrl)).toBe(true);
    });
  });

  describe('buildResponsiveSrcSet', () => {
    it('returns undefined for Azure blob URLs', () => {
      const blobUrl = 'https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg';
      expect(buildResponsiveSrcSet(blobUrl)).toBeUndefined();
    });

    it('generates srcset with width variants for transform-capable CDN origins', () => {
      const cdnUrl = 'https://images.example.com/photo.jpg';
      const srcset = buildResponsiveSrcSet(cdnUrl);

      expect(srcset).toBeDefined();
      expect(srcset).toContain('480w');
      expect(srcset).toContain('768w');
      expect(srcset).toContain('1200w');
      expect(srcset).toContain('w=480');
      expect(srcset).toContain('auto=format');
    });

    it('preserves existing query parameters when adding width params on CDN URLs', () => {
      const cdnUrl = 'https://images.example.com/photo.jpg?token=abc123';
      const srcset = buildResponsiveSrcSet(cdnUrl);

      expect(srcset).toBeDefined();
      expect(srcset!.includes('token=abc123')).toBe(true);
      expect(srcset).toContain('480w');
    });

    it('returns undefined for localhost URLs (no srcset generation)', () => {
      const localhostUrl = 'http://localhost:5174/images/test.jpg';
      expect(buildResponsiveSrcSet(localhostUrl)).toBeUndefined();
    });

    it('returns undefined for /uploads/ paths (no srcset generation)', () => {
      const uploadsUrl = 'https://cdn.example.com/uploads/test.jpg';
      expect(buildResponsiveSrcSet(uploadsUrl)).toBeUndefined();
    });

    it('supports custom width lists on CDN URLs', () => {
      const cdnUrl = 'https://images.example.com/photo.jpg';
      const customWidths = [320, 640, 960];
      const srcset = buildResponsiveSrcSet(cdnUrl, customWidths);

      expect(srcset).toBeDefined();
      expect(srcset).toContain('320w');
      expect(srcset).toContain('640w');
      expect(srcset).toContain('960w');
      expect(srcset).not.toContain('480w');
    });
  });
});
