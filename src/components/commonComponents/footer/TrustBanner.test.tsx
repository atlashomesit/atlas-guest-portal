/** GUEST-BADGE: "Best Rate Guarantee" shows only when the site can tell the 3% add-on does NOT apply. */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const feeMock = vi.hoisted(() => ({ fee: vi.fn(), ctx: vi.fn() }));
vi.mock('@/hooks/useTenantProcessingFee', () => ({ useTenantProcessingFee: () => feeMock.fee() }));
vi.mock('@/tenant/tenantContext', () => ({ getTenantContext: () => feeMock.ctx() }));

import { TrustBanner } from './TrustBanner';

describe('TrustBanner best-rate badge', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('shows the badge (four items) when the add-on is known not to apply', () => {
    feeMock.fee.mockReturnValue(0);
    feeMock.ctx.mockReturnValue({ slug: 'a', name: 'A' });
    render(<TrustBanner />);
    expect(screen.getByText('Best Rate Guarantee')).toBeTruthy();
    expect(screen.getAllByTestId('trust-banner-item')).toHaveLength(4);
  });

  it('hides the badge (three items) when the add-on applies', () => {
    feeMock.fee.mockReturnValue(3);
    feeMock.ctx.mockReturnValue({ slug: 'a', name: 'A' });
    render(<TrustBanner />);
    expect(screen.queryByText('Best Rate Guarantee')).toBeNull();
    expect(screen.getAllByTestId('trust-banner-item')).toHaveLength(3);
  });

  it('hides the badge when the site cannot tell (fee unknown)', () => {
    feeMock.fee.mockReturnValue(null);
    feeMock.ctx.mockReturnValue({ slug: 'a', name: 'A' });
    render(<TrustBanner />);
    expect(screen.queryByText('Best Rate Guarantee')).toBeNull();
    expect(screen.getAllByTestId('trust-banner-item')).toHaveLength(3);
  });

  it('hides the badge on the marketplace root even when the fee reads zero (fees are per listing there)', () => {
    feeMock.fee.mockReturnValue(0);
    feeMock.ctx.mockReturnValue({ slug: 'm', name: 'M', isMarketplaceRoot: true });
    render(<TrustBanner />);
    expect(screen.queryByText('Best Rate Guarantee')).toBeNull();
  });
});
