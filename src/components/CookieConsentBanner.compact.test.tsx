import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CookieConsentBanner from './CookieConsentBanner';
import { getCookieConsent, resetCookieConsent } from '../utils/cookieConsent';

vi.mock('../tenant/tenantContext', () => ({ getTenantContext: () => ({ slug: 'grove', name: 'Grove & Co.' }) }));
vi.mock('../tenant/displayBrand', () => ({ getGuestDataProcessingEntityName: () => 'Grove & Co.' }));
vi.mock('../tenant/tenantOverrides', () => ({ getTenantOverrides: () => ({}) }));

beforeEach(() => {
  resetCookieConsent();
  window.sessionStorage.clear();
});

// GUEST-048: the floating banner covered the hero on a phone. It is now a compact bar the guest can dismiss for the session.
describe('floating cookie banner is compact and dismissible (GUEST-048)', () => {
  it('on a phone the heading is screen-reader-only, a one-sentence copy leads, and both choices stay equal', () => {
    render(<MemoryRouter><CookieConsentBanner /></MemoryRouter>);
    const dialog = screen.getByRole('dialog', { name: 'Your privacy choice' });
    expect(dialog).toHaveClass('fixed');
    expect(screen.getByRole('heading', { name: 'Your privacy choice' })).toHaveClass('sr-only');
    expect(screen.getByTestId('cookie-consent-compact-copy')).toHaveClass('md:hidden');
    expect(screen.getByTestId('cookie-consent-compact-copy')).toHaveTextContent('Grove & Co. uses cookies. Optional analytics cookies load only if you accept.');
    expect(screen.getByRole('link', { name: 'privacy notice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept all' }).className).toBe(screen.getByRole('button', { name: 'Reject non-essential' }).className);
  });

  it('Dismiss hides the bar for the session and records NO consent choice', () => {
    const { unmount } = render(<MemoryRouter><CookieConsentBanner /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('cookie-consent-dismiss'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(getCookieConsent()).toBeNull();
    unmount();
    // Next page of the same session: still hidden. Clearing the session brings it back.
    render(<MemoryRouter><CookieConsentBanner /></MemoryRouter>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the in-flow home consent has no dismiss control and keeps the full wording', () => {
    render(<MemoryRouter><CookieConsentBanner inline /></MemoryRouter>);
    expect(screen.queryByTestId('cookie-consent-dismiss')).toBeNull();
    expect(screen.queryByTestId('cookie-consent-compact-copy')).toBeNull();
    expect(screen.getByRole('region', { name: 'Your privacy choice' })).toHaveTextContent('Under India');
  });
});