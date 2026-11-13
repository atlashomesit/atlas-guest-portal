import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CookieConsentBanner from './CookieConsentBanner';
import { STICKY_BAR_OFFSET_VAR } from './property/propertyHelpEvents';
import { getCookieConsent, resetCookieConsent } from '../utils/cookieConsent';

// A tenant's OWN consent wording (what the API sends as `cookieBanner.text`). Swapped per test.
const LONG_TEXT =
  'Sample Stays uses cookies and similar technologies to run this site, remember your booking details and, only with your consent, to measure which pages are useful. ' +
  "Under India's Digital Personal Data Protection Act 2023 we will not load analytics, advertising or social media cookies until you choose Accept all. " +
  'You can choose Reject non-essential and still book, and you can change your choice at any time from the footer. Read our';
const SHORT_TEXT = 'Sample Stays uses cookies to run this site. Read our';
const tenant = vi.hoisted(() => ({ text: '' }));

vi.mock('../tenant/tenantContext', () => ({
  getTenantContext: () => ({ slug: 'sample', name: 'Sample Stays', cookieBanner: { text: tenant.text, privacyUrl: '/privacy' } }),
}));
vi.mock('../tenant/displayBrand', () => ({ getGuestDataProcessingEntityName: () => 'Sample Stays' }));
vi.mock('../tenant/tenantOverrides', () => ({ getTenantOverrides: () => ({}) }));

// jsdom has no layout: say how tall the text is against how tall its two-line window is.
const layout = (scrollHeight: number, clientHeight: number) => {
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
};

beforeEach(() => {
  resetCookieConsent();
  window.sessionStorage.clear();
  tenant.text = LONG_TEXT;
});
afterEach(() => vi.restoreAllMocks());

const renderFloating = () => render(<MemoryRouter><CookieConsentBanner /></MemoryRouter>);

// GUEST-065 item 4: on a phone the privacy banner covered the Reserve bar (53 of its 65 px, the button included), so a guest
// could not reserve until they answered or dismissed the banner. With a tenant's own long wording the card was 240 px tall.
describe('floating cookie banner never covers the phone Reserve bar (GUEST-065)', () => {
  it('sits on top of the Reserve bar: its bottom edge is the height the Reserve bar publishes, not 0', () => {
    renderFloating();
    const dialog = screen.getByRole('dialog', { name: 'Your privacy choice' });
    expect(dialog.style.bottom).toBe(`var(${STICKY_BAR_OFFSET_VAR}, 0px)`);
    // 0px when no Reserve bar is on the page (and at 768 px and up the bar is not shown), so the banner keeps the bottom edge there.
    expect(dialog).not.toHaveClass('bottom-0');
  });

  it('the in-flow home consent is not positioned at all', () => {
    render(<MemoryRouter><CookieConsentBanner inline /></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Your privacy choice' }).style.bottom).toBe('');
  });
});

describe("a tenant's own consent wording stays complete but takes two lines on a phone (GUEST-065)", () => {
  it('keeps every word in the page, clamps it to two lines on a phone only, and keeps the privacy link visible', () => {
    layout(120, 32);
    renderFloating();
    const text = screen.getByTestId('cookie-consent-tenant-text');
    expect(text).toHaveTextContent(LONG_TEXT);
    expect(text).toHaveClass('line-clamp-2');
    expect(text).toHaveClass('md:line-clamp-none');
    // The link sits after the clamped text, so it is never one of the clipped lines.
    expect(screen.getByRole('link', { name: 'privacy notice' })).toBeInTheDocument();
    expect(screen.queryByTestId('cookie-consent-compact-copy')).toBeNull();
  });

  it('"Read more" shows the whole wording and "Show less" folds it back; neither records a consent choice', () => {
    layout(120, 32);
    renderFloating();
    const toggle = screen.getByTestId('cookie-consent-read-more');
    expect(toggle).toHaveTextContent('Read more');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', screen.getByTestId('cookie-consent-tenant-text').id);

    fireEvent.click(toggle);
    expect(screen.getByTestId('cookie-consent-tenant-text')).not.toHaveClass('line-clamp-2');
    expect(screen.getByTestId('cookie-consent-tenant-text')).toHaveTextContent(LONG_TEXT);
    expect(screen.getByTestId('cookie-consent-read-more')).toHaveTextContent('Show less');
    expect(screen.getByTestId('cookie-consent-read-more')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toHaveTextContent('for details. You can change your choice any time.');

    fireEvent.click(screen.getByTestId('cookie-consent-read-more'));
    expect(screen.getByTestId('cookie-consent-tenant-text')).toHaveClass('line-clamp-2');
    expect(getCookieConsent()).toBeNull();
  });

  it('wording that already fits in two lines has no "Read more"', () => {
    tenant.text = SHORT_TEXT;
    layout(32, 32);
    renderFloating();
    expect(screen.getByTestId('cookie-consent-tenant-text')).toHaveTextContent(SHORT_TEXT);
    expect(screen.queryByTestId('cookie-consent-read-more')).toBeNull();
  });

  it('consent behaviour is unchanged: Accept and Reject keep equal weight and record their choice, Dismiss records none', () => {
    layout(120, 32);
    const { unmount } = renderFloating();
    expect(screen.getByRole('button', { name: 'Accept all' }).className).toBe(screen.getByRole('button', { name: 'Reject non-essential' }).className);
    fireEvent.click(screen.getByTestId('cookie-consent-dismiss'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(getCookieConsent()).toBeNull();
    unmount();

    window.sessionStorage.clear();
    renderFloating();
    fireEvent.click(screen.getByRole('button', { name: 'Reject non-essential' }));
    expect(getCookieConsent()?.choice).toBe('rejected');
  });

  it('the in-flow home consent keeps the full wording with no clamp and no "Read more"', () => {
    layout(120, 32);
    render(<MemoryRouter><CookieConsentBanner inline /></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Your privacy choice' })).toHaveTextContent(LONG_TEXT);
    expect(screen.queryByTestId('cookie-consent-tenant-text')).toBeNull();
    expect(screen.queryByTestId('cookie-consent-read-more')).toBeNull();
  });
});
