import { describe, expect, it } from 'vitest';
import { clampedBrandColor, ctaStyle, readableCtaText } from './EmbedPage';

// TASK-10170 residual: property test proving the CTA clamp holds WCAG AA 4.5:1
// across the color band. The fix (46d79a76) blends the brand background out of the
// dead band L in (0.18333, 0.21631) where neither #ffffff nor #111827 reaches 4.5:1.
// These helpers intentionally re-derive WCAG relative luminance / contrast locally
// so the test does not assert the implementation against itself.

// ── Independent WCAG helpers (duplicated, not imported) ─────────────────────

function testLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function testContrast(l1: number, l2: number): number {
  const hi = l1 > l2 ? l1 : l2;
  const lo = l1 > l2 ? l2 : l1;
  return (hi + 0.05) / (lo + 0.05);
}

function testParse(hex: string): [number, number, number] {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) throw new Error(`invalid hex in test: ${hex}`);
  const full = m[1].length === 3 ? m[1].split('').map((c) => `${c}${c}`).join('') : m[1];
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

const DARK_LUM = testLuminance(0x11, 0x18, 0x27);
const WHITE_LUM = 1;

function contrastOfPair(background: string, text: string): number {
  const [r, g, b] = testParse(background);
  const lum = testLuminance(r, g, b);
  const textLum = text.toLowerCase() === '#111827' ? DARK_LUM : WHITE_LUM;
  return testContrast(lum, textLum);
}

function toHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

describe('TASK-10170 CTA contrast clamp', () => {
  it('clears 4.5:1 for the reported dead-band examples', () => {
    // Worst cases from the fix commit message: #2E86AB was 4.32, #D9534F was 4.48.
    for (const brand of ['#2E86AB', '#D9534F']) {
      const { background, color } = ctaStyle(brand);
      expect(contrastOfPair(background, color)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('holds 4.5:1 for every color on a coarse exhaustive hex grid', () => {
    // 16 levels per channel (0x00, 0x11, ... 0xFF) = 4096 backgrounds, covering the
    // full sRGB cube including the entire dead band. Runs in well under a second.
    const levels = Array.from({ length: 16 }, (_, i) => i * 17);
    let checked = 0;
    for (const r of levels) {
      for (const g of levels) {
        for (const b of levels) {
          const brand = toHex(r, g, b);
          const { background, color } = ctaStyle(brand);
          expect(
            contrastOfPair(background, color),
            `ctaStyle(${brand}) -> bg ${background} text ${color}`,
          ).toBeGreaterThanOrEqual(4.5);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(4096);
  });

  it('leaves already-passing brand colors untouched', () => {
    expect(clampedBrandColor('#ffffff')).toBe('#ffffff');
    expect(clampedBrandColor('#000000')).toBe('#000000');
    expect(clampedBrandColor('#0f766e')).toBe('#0f766e');
  });

  it('pairs the clamped background with its optimal text color', () => {
    for (const brand of ['#2E86AB', '#D9534F', '#777777', '#888888', '#0f766e', '#ffffff']) {
      const { background, color } = ctaStyle(brand);
      expect(background).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color).toBe(readableCtaText(background));
    }
  });

  it('passes invalid input through without throwing', () => {
    expect(clampedBrandColor('not-a-color')).toBe('not-a-color');
    expect(clampedBrandColor('')).toBe('');
    expect(readableCtaText('not-a-color')).toBe('var(--text-on-cta, #ffffff)');
  });
});
