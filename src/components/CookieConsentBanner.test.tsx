import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CookieConsentBanner from './CookieConsentBanner';
import { getCookieConsent, hasAcceptedCookies, resetCookieConsent } from '../utils/cookieConsent';

vi.mock('../tenant/tenantContext', () => ({ getTenantContext: () => ({ slug: 'review-guest-house', name: 'Review Guest House' }) }));
vi.mock('../tenant/displayBrand', () => ({ getGuestDataProcessingEntityName: () => 'Review Guest House' }));
vi.mock('../tenant/tenantOverrides', () => ({ getTenantOverrides: () => ({}) }));

beforeEach(() => resetCookieConsent());
describe('tenant homepage inline consent', () => {
  it('keeps tenant identity and equally prominent choices in document flow', () => {
    render(<MemoryRouter><CookieConsentBanner inline /></MemoryRouter>);
    const region = screen.getByRole('region', { name: 'Your privacy choice' });
    expect(region).toHaveClass('home-privacy-choice');
    expect(region).not.toHaveClass('fixed');
    expect(region).toHaveTextContent('Review Guest House uses');
    expect(region).not.toHaveTextContent('Atlas Homestays');
    expect(screen.getByRole('button', { name:'Accept all' }).className).toBe(screen.getByRole('button', { name:'Reject non-essential' }).className);
    expect(hasAcceptedCookies()).toBe(false);
  });
  it('persists rejection without treating it as analytics consent', () => {
    render(<MemoryRouter><CookieConsentBanner inline /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name:'Reject non-essential' }));
    expect(getCookieConsent()?.choice).toBe('rejected');
    expect(hasAcceptedCookies()).toBe(false);
    expect(screen.queryByRole('region')).toBeNull();
  });
  it('persists acceptance and keeps the global banner on other routes', () => {
    render(<MemoryRouter><CookieConsentBanner /></MemoryRouter>);
    expect(screen.getByRole('dialog')).toHaveClass('fixed');
    fireEvent.click(screen.getByRole('button', { name:'Accept all' }));
    expect(getCookieConsent()?.choice).toBe('accepted');
    expect(hasAcceptedCookies()).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
