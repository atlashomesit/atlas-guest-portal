import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SubdomainNotActivatedScreen from './SubdomainNotActivatedScreen';
import { NOT_TAKING_BOOKINGS_COPY } from '../tenant/paymentRail';
import {
  _resetTenantContextForTests,
  resolveFromDomain,
  SubdomainNotActivatedError,
} from '../tenant/tenantContext';

describe('SubdomainNotActivatedScreen', () => {
  it('default variant keeps the owner pitch and testid', () => {
    render(<SubdomainNotActivatedScreen />);
    expect(screen.getByTestId('subdomain-not-activated')).toBeTruthy();
    expect(screen.getByText('Activate your site')).toBeTruthy();
  });

  it('not-taking-bookings variant is guest-only: copy, no pitch, no links', () => {
    const { container } = render(<SubdomainNotActivatedScreen notTakingBookings />);
    expect(screen.getByTestId('subdomain-not-taking-bookings')).toBeTruthy();
    expect(screen.queryByTestId('subdomain-not-activated')).toBeNull();
    expect(screen.getByRole('heading').textContent).toBe(NOT_TAKING_BOOKINGS_COPY);
    expect(screen.queryByText('Activate your site')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('resolveFromDomain 404 signal', () => {
  beforeEach(() => {
    _resetTenantContextForTests();
    vi.restoreAllMocks();
  });
  const mock404 = (body: unknown) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => body }));

  it.each([
    [{ error: 'SUBDOMAIN_NOT_ACTIVATED', blocker: 'NOT_TAKING_BOOKINGS_RIGHT_NOW' }],
    [{ error: 'SUBDOMAIN_NOT_ACTIVATED', notTakingBookings: true }],
  ])('carries notTakingBookings for %j', async (body) => {
    mock404(body);
    const err = await resolveFromDomain('https://api.test', 'a.example.com').catch((e) => e);
    expect(err).toBeInstanceOf(SubdomainNotActivatedError);
    expect(err.notTakingBookings).toBe(true);
  });

  it('plain SUBDOMAIN_NOT_ACTIVATED stays the old variant', async () => {
    mock404({ error: 'SUBDOMAIN_NOT_ACTIVATED' });
    const err = await resolveFromDomain('https://api.test', 'b.example.com').catch((e) => e);
    expect(err).toBeInstanceOf(SubdomainNotActivatedError);
    expect(err.notTakingBookings).toBe(false);
  });
});
