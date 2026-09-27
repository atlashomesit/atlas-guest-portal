import { describe, it, expect } from 'vitest';
import { MINIBAR_MENU, buildFolioLines } from './minibarOrdering';

describe('TASK-102206 minibar ordering + folio posting', () => {
  it('menu items carry pricing, dietary badges, and lead times', () => {
    for (const m of MINIBAR_MENU) {
      expect(m.priceInr).toBeGreaterThan(0);
      expect(['Veg', 'Non-Veg', 'Vegan']).toContain(m.diet);
      expect(m.leadTimeMins).toBeGreaterThan(0);
    }
  });

  it('posts folio lines with totals and slowest lead time', () => {
    const r = buildFolioLines({ 'masala-chai': 2, 'breakfast-basket': 1, unknown: 5, 'chicken-sandwich': 0 });
    expect(r.totalInr).toBe(149 * 2 + 499);
    expect(r.lines).toHaveLength(2);
    expect(r.maxLeadTimeMins).toBe(30);
  });
});
