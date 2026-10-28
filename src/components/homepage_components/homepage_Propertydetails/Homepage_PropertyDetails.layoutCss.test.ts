import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * TOP10-2026-10-27-01 review fixes, locked as CSS contracts (jsdom does no layout, so the
 * rendered result is covered by the browser check in the PR; these stop the rules regressing).
 */
const css = readFileSync(resolve(__dirname, 'Homepage_PropertyDetails.css'), 'utf-8').replace(/\r\n/g, '\n');

type Rule = { selector: string; body: string };
const rules: Rule[] = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(),
  body: m[2],
}));

describe('property page gallery fit (guest #661 review G3)', () => {
  it('object-fit: contain !important applies only to the approved two-photo layout', () => {
    const forced = rules.filter((r) => /object-fit\s*:\s*[a-z-]+\s*!important/i.test(r.body));
    expect(forced.length).toBeGreaterThan(0);
    for (const r of forced) {
      expect(r.selector, `${r.selector} forces object-fit`).toContain('.pp-two-photo');
    }
  });

  it('no .pp-book-beside rule changes how gallery images are fitted (3+ photos keep cover)', () => {
    const leaking = rules.filter(
      (r) => r.selector.includes('.pp-book-beside') && r.selector.includes('.pp-gallery-img') && /object-fit/.test(r.body),
    );
    expect(leaking).toEqual([]);
  });

  it('the one-photo gallery still shows the whole image (not forced)', () => {
    const single = rules.find((r) => r.selector === '.pp-single-photo .pp-gallery-img');
    expect(single?.body).toMatch(/object-fit\s*:\s*contain\s*;/);
    expect(single?.body).not.toMatch(/!important/);
  });
});

describe('property page virtual tour next to the booking card (guest #661 review G4)', () => {
  it('puts both tour blocks in the left column so they cannot drop under the booking card', () => {
    const tour = rules.find((r) => r.selector.includes('.pp-book-beside .pp-tour-block'));
    expect(tour?.selector).toContain('[data-testid="virtual-tour-section"]');
    expect(tour?.body).toMatch(/grid-column\s*:\s*1\s*;/);
  });

  it('lets the booking card span down to the long left column when a tour is present', () => {
    const span = rules.find((r) => r.selector.includes(':has(') && r.selector.includes('.pp-booking-col'));
    expect(span?.body).toMatch(/grid-row\s*:\s*3\s*\/\s*span\s*6/);
  });

  it('the inline tour block keeps its 24px top margin outside the beside layout (moved from inline style)', () => {
    const base = rules.find((r) => r.selector === '.pp-tour-block');
    expect(base?.body).toMatch(/margin-top\s*:\s*24px/);
  });
});

describe('property page booking card Reserve reachability (worst-10 verifier check 5)', () => {
  it('moves the card preview photo below the card content so Reserve stays inside the pinned card', () => {
    const flex = rules.find((r) => r.selector === '.pp-book-beside .lv-booking');
    expect(flex?.body).toMatch(/display\s*:\s*flex/);
    expect(flex?.body).toMatch(/flex-direction\s*:\s*column/);
    const photo = rules.find((r) => r.selector === '.pp-book-beside .lv-booking-preview');
    expect(photo?.body).toMatch(/order\s*:\s*99/);
  });
});
