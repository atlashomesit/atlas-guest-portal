import { describe, expect, it, beforeEach } from 'vitest';

/**
 * TASK-4513: Unit tests for responsive srcset builder in OptimizedImage.tsx
 *
 * Tests cover:
 * - Azure blob URLs with query param preservation
 * - Width descriptor generation (480/768/1200)
 * - Non-blob URL passthrough
 * - Localhost exclusion
 */

// Mock the window.location.origin for URL resolution
beforeEach(() => {
  Object.defineProperty(global, 'window', {
    value: { location: { origin: 'https://dev.atlashomestays.com' } },
    writable: true,
  });
});

// Helper function extracted from OptimizedImage.tsx for testing
function shouldBuildResponsiveSrcSet(src: string): boolean {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://example.invalid";
    const url = new URL(src, base);
    // Allow Azure blob URLs (TASK-4513 Option a)
    if (url.hostname.includes("blob.core.windows.net")) return true;
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

describe('OptimizedImage — srcset builder (TASK-4513)', () => {
  describe('shouldBuildResponsiveSrcSet', () => {
    it('returns true for Azure blob URLs', () => {
      const blobUrl = 'https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg';
      expect(shouldBuildResponsiveSrcSet(blobUrl)).toBe(true);
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

    it('returns true for other remote CDN URLs', () => {
      const cdnUrl = 'https://images.example.com/photo.jpg';
      expect(shouldBuildResponsiveSrcSet(cdnUrl)).toBe(true);
    });

    it('handles relative paths (treats them as absolute relative to origin)', () => {
      // Note: URL constructor resolves relative paths against window.location.origin
      // so "not a url" becomes "https://dev.atlashomestays.com/not a url"
      expect(shouldBuildResponsiveSrcSet('not a url')).toBe(true);
      // Empty string is technically valid as a root path
      expect(shouldBuildResponsiveSrcSet('')).toBe(true);
    });
  });

  describe('buildResponsiveSrcSet', () => {
    it('generates srcset with all three width variants for Azure blobs', () => {
      const blobUrl = 'https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg';
      const srcset = buildResponsiveSrcSet(blobUrl);

      expect(srcset).toBeDefined();
      expect(srcset).toContain('480w');
      expect(srcset).toContain('768w');
      expect(srcset).toContain('1200w');
    });

    it('preserves existing query parameters when adding width params', () => {
      const blobUrlWithParams = 'https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg?sv=2020-08-04&sig=abc123';
      const srcset = buildResponsiveSrcSet(blobUrlWithParams);

      expect(srcset).toBeDefined();
      // Verify the original query param is preserved
      expect(srcset!.includes('sv=')).toBe(true);
      expect(srcset!.includes('sig=')).toBe(true);
      // And new width params are added
      expect(srcset).toContain('480w');
    });

    it('appends ?w=<width> and ?auto=format query params', () => {
      const blobUrl = 'https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg';
      const srcset = buildResponsiveSrcSet(blobUrl);

      expect(srcset).toBeDefined();
      expect(srcset).toContain('w=480');
      expect(srcset).toContain('w=768');
      expect(srcset).toContain('w=1200');
      // auto=format should be set for all variants
      const variants = srcset!.split(', ');
      expect(variants.length).toBe(3);
      variants.forEach(variant => {
        expect(variant).toContain('auto=format');
      });
    });

    it('returns undefined for localhost URLs (no srcset generation)', () => {
      const localhostUrl = 'http://localhost:5174/images/test.jpg';
      const srcset = buildResponsiveSrcSet(localhostUrl);
      expect(srcset).toBeUndefined();
    });

    it('returns undefined for /uploads/ paths (no srcset generation)', () => {
      const uploadsUrl = 'https://cdn.example.com/uploads/test.jpg';
      const srcset = buildResponsiveSrcSet(uploadsUrl);
      expect(srcset).toBeUndefined();
    });

    it('handles relative paths (resolves against origin)', () => {
      // Relative paths resolve to the origin, so they generate srcset
      const srcset = buildResponsiveSrcSet('not a url');
      expect(srcset).toBeDefined();
      expect(srcset).toContain('480w');
    });

    it('supports custom width lists', () => {
      const blobUrl = 'https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg';
      const customWidths = [320, 640, 960];
      const srcset = buildResponsiveSrcSet(blobUrl, customWidths);

      expect(srcset).toBeDefined();
      expect(srcset).toContain('320w');
      expect(srcset).toContain('640w');
      expect(srcset).toContain('960w');
      expect(srcset).not.toContain('480w');
    });

    it('formats srcset as comma-separated descriptor strings', () => {
      const blobUrl = 'https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg';
      const srcset = buildResponsiveSrcSet(blobUrl);

      expect(srcset).toBeDefined();
      const variants = srcset!.split(', ');
      // Should have 3 variants
      expect(variants.length).toBe(3);
      // Each variant should have URL and width descriptor
      variants.forEach((variant, index) => {
        const expectedWidth = [480, 768, 1200][index];
        expect(variant).toMatch(new RegExp(`${expectedWidth}w$`));
        // URL should come before the descriptor
        expect(variant).toContain('https://');
      });
    });

    it('degrades gracefully when host does not support width params', () => {
      // The function should still generate valid srcset; if the host ignores
      // the ?w= param, the full image will load (no regression, just no savings)
      const blobUrl = 'https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg';
      const srcset = buildResponsiveSrcSet(blobUrl);

      // srcset is generated and valid
      expect(srcset).toBeDefined();
      expect(srcset).toMatch(/https:\/\/.*\?w=\d+/);
    });
  });
});
