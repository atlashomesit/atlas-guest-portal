import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * TASK-102426 — hero must be responsive: a phone must never download the desktop
 * asset. Previously the classic hero was a single-1200w CSS background-image (no
 * srcset possible, always full-res). Now a real <img> over the /img transform proxy
 * with srcset/sizes, eager as the LCP element.
 */
describe('Slider hero — TASK-102426 responsive sizing', () => {
  const filePath = resolve(__dirname, './Slider.tsx');
  const content = readFileSync(filePath, 'utf-8');

  it('renders the hero photo as <img> with srcset/sizes, not CSS background-image', () => {
    expect(content).toContain('buildGuestImageSrcSet(HERO_IMAGE_URL)');
    expect(content).toMatch(/<img[\s\S]{0,500}srcSet=\{heroImageSrcSet\}/);
    expect(content).toMatch(/sizes="\(max-width: 760px\) 100vw, 50vw"/);
    expect(content).not.toMatch(/backgroundImage: `url\("\$\{heroImageUrl\}"\)`/);
  });

  it('keeps the hero eager with high fetch priority (LCP element)', () => {
    expect(content).toContain('loading="eager"');
    expect(content).toContain('fetchPriority="high"');
  });
});
