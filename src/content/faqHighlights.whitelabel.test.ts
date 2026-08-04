import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../tenant/tenantContext', () => ({
  getTenantContext: vi.fn(),
}));
vi.mock('../tenant/tenantOverrides', () => ({
  getTenantOverrides: () => ({}),
}));
vi.mock('../tenant/tenantResolver', () => ({
  isMarketplaceMode: () => false,
}));
vi.mock('../config/contact', () => ({
  formatDisplayNumber: () => '+91-0000000000',
}));

import { getTenantContext } from '../tenant/tenantContext';
import { getFaqHighlights } from './faqHighlights';

describe('getFaqHighlights white-label (TASK-7194)', () => {
  beforeEach(() => {
    vi.mocked(getTenantContext).mockReturnValue({
      slug: 'millionairesmansion',
      name: 'Millionaresmansion',
      guestCommsBrandingMode: 'Neutral',
    } as ReturnType<typeof getTenantContext>);
  });

  it('does not leak Atlas demo unit / Hyderabad neighbourhood copy', () => {
    const text = getFaqHighlights()
      .map((f) => `${f.question} ${f.answer}`)
      .join('\n')
      .toLowerCase();
    expect(text).not.toMatch(/penthouse/);
    expect(text).not.toMatch(/hyderabad/);
    expect(text).not.toMatch(/kphb/);
    expect(text).not.toMatch(/hitecity/);
    expect(text).not.toMatch(/jubilee hills/);
  });
});
