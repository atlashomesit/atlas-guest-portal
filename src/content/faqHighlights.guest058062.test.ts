import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../tenant/tenantContext', () => ({ getTenantContext: vi.fn() }));
vi.mock('../tenant/tenantOverrides', () => ({ getTenantOverrides: () => ({}) }));
vi.mock('../tenant/tenantResolver', () => ({ isMarketplaceMode: vi.fn(() => false) }));
vi.mock('../config/contact', () => ({ formatDisplayNumber: () => '+91-0000000000', isWhiteLabelTenant: () => true }));

import { getTenantContext } from '../tenant/tenantContext';
import { isMarketplaceMode } from '../tenant/tenantResolver';
import { getFaqHighlights, getStandardStayTimes } from './faqHighlights';
import { inlinePolicySnippets, termsSections } from './terms';

const asTenant = (v: Record<string, unknown>) =>
  vi.mocked(getTenantContext).mockReturnValue(v as ReturnType<typeof getTenantContext>);

describe('GUEST-058: shared FAQ and terms do not state one host extra-guest numbers', () => {
  const allText = () =>
    [
      ...getFaqHighlights().map((f) => f.answer),
      ...termsSections.flatMap((s) => [...(s.paragraphs ?? []), ...(s.bullets ?? [])]),
      inlinePolicySnippets.extraGuests,
    ].join('\n');

  it.each([
    ['a white-label host', { slug: 'hostone', name: 'Host One', guestCommsBrandingMode: 'Neutral' }],
    ['the Atlas demo FAQ', { slug: 'atlas', name: 'Atlas' }],
  ])('%s: no fixed rupee range and no "two guests included"', (_n, tenant) => {
    asTenant(tenant);
    vi.mocked(isMarketplaceMode).mockReturnValue(false);
    const text = allText();
    expect(text).not.toMatch(/400|600/);
    expect(text).not.toMatch(/includes (2|two) guests/i);
    expect(text).not.toMatch(/covers 2 guests/i);
    expect(text).toMatch(/guests the host includes|guests included|covers the (number of )?guests/i);
  });
});

describe('GUEST-062: standard check-in and check-out times come only from a FAQ that states them', () => {
  beforeEach(() => vi.mocked(isMarketplaceMode).mockReturnValue(false));

  it('white-label host: the same 2:00 PM / 11:00 AM the FAQ states', () => {
    asTenant({ slug: 'hosttwo', name: 'Host Two', guestCommsBrandingMode: 'Neutral' });
    expect(getStandardStayTimes()).toEqual({ checkIn: '2:00 PM', checkOut: '11:00 AM' });
    const faq = getFaqHighlights().find((f) => f.id === 'checkin-checkout')!.answer;
    expect(faq).toContain('2:00 PM');
    expect(faq).toContain('11:00 AM');
  });

  it('a tenant with its own FAQ gets no invented time', () => {
    asTenant({ slug: 'hostthree', name: 'Host Three', faq: [{ id: 'x', question: 'q', answer: 'a' }] });
    expect(getStandardStayTimes()).toBeNull();
  });

  it('the Atlas / marketplace FAQ names no times, so the listing page names none either', () => {
    asTenant({ slug: 'atlas', name: 'Atlas' });
    expect(getStandardStayTimes()).toBeNull();
  });
});
