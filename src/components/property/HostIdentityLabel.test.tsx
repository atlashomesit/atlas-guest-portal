import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HostIdentityLabel from './HostIdentityLabel';
import MarketplaceHostIdentity from './MarketplaceHostIdentity';
import { settle } from '../../test/settle';
vi.mock('@/api/client', () => ({ buildApiUrl: (path: string) => `/api${path}` }));
afterEach(() => vi.unstubAllGlobals());

describe('marketplace identity fact', () => {
  it.each([false, null, undefined, 'true', 1])('never treats %s as verification', value => {
    render(<HostIdentityLabel marketplace verified={value} />);
    expect(screen.queryByText('ID-verified host')).not.toBeInTheDocument();
  });
  it('never shows the label on a tenant site', () => {
    render(<HostIdentityLabel verified={true} />);
    expect(screen.queryByText('ID-verified host')).not.toBeInTheDocument();
  });
  it('names the checked ID and explicitly limits the claim', () => {
    render(<HostIdentityLabel marketplace verified={true} explain />);
    expect(screen.getByText('ID-verified host')).toBeInTheDocument();
    expect(screen.getByText(/PAN and Aadhaar/)).toHaveTextContent('This does not verify the property or guarantee your stay.');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('does not read marketplace identity on a tenant site', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<MarketplaceHostIdentity marketplace={false} listingId={9001} />);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reads current public identity without cache and drops the claim when the listing changes', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ listingId: 9001, hostIdentityVerified: true }) }).mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetch);
    const { rerender } = render(<MarketplaceHostIdentity marketplace listingId={9001} />);
    await settle();
    expect(screen.getByText('ID-verified host')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/marketplace/properties/9001', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }));
    rerender(<MarketplaceHostIdentity marketplace listingId={9002} />);
    expect(screen.queryByText('ID-verified host')).not.toBeInTheDocument();
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([{ listingId: 9002, hostIdentityVerified: true }, { listingId: 9001, hostIdentityVerified: 'true' }])('refuses mismatched or malformed DTOs', async payload => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => payload }); vi.stubGlobal('fetch', fetch);
    render(<MarketplaceHostIdentity marketplace listingId={9001} />);
    await settle();
    expect(fetch).toHaveBeenCalled();
    expect(screen.queryByText('ID-verified host')).not.toBeInTheDocument();
  });
});
