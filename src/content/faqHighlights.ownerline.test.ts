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
  formatDisplayNumber: vi.fn(),
}));

import { formatDisplayNumber } from '../config/contact';
import { getTenantContext } from '../tenant/tenantContext';
import { getFaqHighlights } from './faqHighlights';

function mockWhiteLabelTenant() {
  vi.mocked(getTenantContext).mockReturnValue({
    slug: 'whitelabel-tenant',
    name: 'WhiteLabel Tenant',
    guestCommsBrandingMode: 'Neutral',
  } as ReturnType<typeof getTenantContext>);
}

describe('getFaqHighlights owner line (TASK-101710)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhiteLabelTenant();
  });

  it('omits the owner escalation clause when owner phone is empty', () => {
    vi.mocked(formatDisplayNumber).mockImplementation(
      (channel: string = 'business') => (channel === 'owner' ? '' : '+91-9999999999'),
    );
    const support = getFaqHighlights().find((f) => f.id === 'support-contact');
    expect(support).toBeDefined();
    expect(support!.answer).not.toMatch(/owner line is/);
    expect(support!.answer).not.toMatch(/owner line is \./);
    expect(support!.answer).toMatch(/Message us on WhatsApp/);
  });

  it('keeps the owner escalation clause when owner phone is present', () => {
    vi.mocked(formatDisplayNumber).mockImplementation(
      (channel: string = 'business') =>
        channel === 'owner' ? '+91-9111111111' : '+91-9999999999',
    );
    const support = getFaqHighlights().find((f) => f.id === 'support-contact');
    expect(support).toBeDefined();
    expect(support!.answer).toMatch(/owner line is \+91-9111111111/);
  });
});
