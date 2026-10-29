import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGuestPriceBreakdown, fetchPublicListingRatePlans } from '../pricingClient';
import { createOrder } from '../payment';
import { clearAgentCode, captureAgentCodeFromUrl } from '@/lib/agentCode';

describe('PRICE-016 agent code in the guest API client', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    clearAgentCode();
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    clearAgentCode();
    vi.unstubAllGlobals();
  });

  const okJson = (body: unknown) => ({ ok: true, json: async () => body });

  it('sends no agentCode for an ordinary guest', async () => {
    fetchSpy.mockResolvedValueOnce(okJson([]));
    await fetchPublicListingRatePlans(42, '2027-06-10', '2027-06-12', 2);
    expect(fetchSpy.mock.calls[0][0]).not.toContain('agentCode');
  });

  it('sends the remembered agent code with the rate-plan list, and maps the unlocked agent card', async () => {
    captureAgentCodeFromUrl('?agent=sunrise-net-01');
    fetchSpy.mockResolvedValueOnce(okJson([
      { id: 11, listingId: 42, name: 'Standard', isDefault: true, sortOrder: 0, baseNightlyRate: 6000, effectiveNightlyRate: 6000, guests: 2 },
      { id: 12, listingId: 42, name: 'Sunrise', isDefault: false, sortOrder: 1, baseNightlyRate: 3000, effectiveNightlyRate: 3000, guests: 2, isAgentRate: true, agentName: 'Sunrise Travels' },
    ]));

    const plans = await fetchPublicListingRatePlans(42, '2027-06-10', '2027-06-12', 2);

    expect(fetchSpy.mock.calls[0][0]).toContain('agentCode=SUNRISE-NET-01');
    expect(plans[0].isAgentRate).toBe(false);
    expect(plans[1].isAgentRate).toBe(true);
    expect(plans[1].agentName).toBe('Sunrise Travels');
  });

  it('adds the code to the quote only when a rate plan is named', async () => {
    captureAgentCodeFromUrl('?agent=SUNRISE-NET-01');
    fetchSpy.mockResolvedValue(okJson({ baseAmount: 6000, finalAmount: 6000 }));

    await fetchGuestPriceBreakdown(42, '2027-06-10', '2027-06-12', undefined, 12, 2);
    expect(fetchSpy.mock.calls[0][0]).toContain('listingRatePlanId=12');
    expect(fetchSpy.mock.calls[0][0]).toContain('agentCode=SUNRISE-NET-01');

    await fetchGuestPriceBreakdown(42, '2027-06-10', '2027-06-12', undefined, null, 2);
    expect(fetchSpy.mock.calls[1][0]).not.toContain('agentCode');
  });

  it('puts the code in the order draft only when the draft names a rate plan', async () => {
    captureAgentCodeFromUrl('?agent=SUNRISE-NET-01');
    fetchSpy.mockResolvedValue({ ok: true });
    const draft = { listingId: 42, checkinDate: '2027-06-10', checkoutDate: '2027-06-12', guests: 2 };

    await createOrder({ bookingDraft: { ...draft, listingRatePlanId: 12 } }, 'idem-1', 'acme');
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).bookingDraft.agentAccessCode).toBe('SUNRISE-NET-01');

    await createOrder({ bookingDraft: { ...draft, listingRatePlanId: null } }, 'idem-2', 'acme');
    expect(JSON.parse(fetchSpy.mock.calls[1][1].body).bookingDraft).not.toHaveProperty('agentAccessCode');

    // the final-charge step sends no draft plan: the server keeps the held booking's agent price
    await createOrder({ holdId: 5, holdToken: 't' }, 'idem-3', 'acme');
    expect(JSON.parse(fetchSpy.mock.calls[2][1].body)).not.toHaveProperty('bookingDraft');
  });

  it('sends no agentAccessCode for an ordinary guest even with a plan chosen', async () => {
    fetchSpy.mockResolvedValue({ ok: true });
    await createOrder({ bookingDraft: { listingId: 42, checkinDate: 'a', checkoutDate: 'b', guests: 2, listingRatePlanId: 11 } }, 'idem-4', 'acme');
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).bookingDraft).not.toHaveProperty('agentAccessCode');
  });
});
