import { describe, expect, it } from 'vitest';
import { buildResponsiveSrcSet, shouldBuildResponsiveSrcSet } from '../OptimizedImage';

describe('OptimizedImage — srcset builder (TASK-7433)', () => {
  describe('shouldBuildResponsiveSrcSet', () => {
    it('returns false for Azure blob URLs (origin ignores resize params)', () => {
      const blobUrl = 'https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg';
      expect(shouldBuildResponsiveSrcSet(blobUrl)).toBe(false);
    });

    it('returns false for localhost URLs', () => {
      expect(shouldBuildResponsiveSrcSet('http://localhost:5174/images/test.jpg')).toBe(false);
    });

    it('returns false for 127.0.0.1 URLs', () => {
      expect(shouldBuildResponsiveSrcSet('http://127.0.0.1:5174/images/test.jpg')).toBe(false);
    });

    it('returns false for /uploads/ paths', () => {
      expect(shouldBuildResponsiveSrcSet('https://cdn.example.com/uploads/test.jpg')).toBe(false);
    });

    it('returns true for transform-capable remote CDN URLs', () => {
      expect(shouldBuildResponsiveSrcSet('https://images.example.com/photo.jpg')).toBe(true);
    });
  });

  describe('buildResponsiveSrcSet', () => {
    it('returns undefined for Azure blob URLs (no decorative srcset)', () => {
      const blobUrl = 'https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg';
      expect(buildResponsiveSrcSet(blobUrl)).toBeUndefined();
    });

    it('generates width variants only for transform-capable CDN origins', () => {
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

    it('returns undefined for localhost URLs', () => {
      expect(buildResponsiveSrcSet('http://localhost:5174/images/test.jpg')).toBeUndefined();
    });

    it('returns undefined for /uploads/ paths', () => {
      expect(buildResponsiveSrcSet('https://cdn.example.com/uploads/test.jpg')).toBeUndefined();
    });

    it('supports custom width lists on CDN URLs', () => {
      const srcset = buildResponsiveSrcSet('https://images.example.com/photo.jpg', [320, 640, 960]);
      expect(srcset).toBeDefined();
      expect(srcset).toContain('320w');
      expect(srcset).toContain('640w');
      expect(srcset).toContain('960w');
      expect(srcset).not.toContain('480w');
    });
  });
});
