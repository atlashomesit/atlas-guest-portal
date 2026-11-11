import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SupportWidget from './SupportWidget';

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="route">{location.pathname}{location.search}{location.hash}</output>;
}
function open(route: string) {
  render(<MemoryRouter initialEntries={[route]}><SupportWidget /><CurrentLocation /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /chat with us/i }));
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

describe('GUEST-006 drawer issue entry', () => {
  test('booking category links preserve the private token only on the internal message route', () => {
    open('/booking/41?t=private-token');
    const link = screen.getByRole('link', { name: 'Maintenance' });
    expect(link).toHaveAttribute('href', '/booking/41?t=private-token&issue=maintenance#guest-messages');
    fireEvent.click(link);
    expect(screen.getByTestId('route')).toHaveTextContent('/booking/41?t=private-token&issue=maintenance#guest-messages');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  test.each(['/faq', '/booking/41', '/booking/not-a-booking?t=t'])('without a usable booking link, %s directs guests to their bookings', (route) => {
    open(route);
    expect(screen.getByRole('link', { name: 'Open my bookings' })).toHaveAttribute('href', '/my-bookings');
    expect(screen.getByText(/link from your booking confirmation email/)).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Maintenance' })).not.toBeInTheDocument();
  });
  test('WhatsApp prefill excludes the private booking token', () => {
    window.history.replaceState(null, '', '/booking/41?t=never-share-this-token&issue=access');
    open('/booking/41?t=never-share-this-token');
    const whatsapp = screen.getByRole('link', { name: /whatsapp/i });
    expect(decodeURIComponent(whatsapp.getAttribute('href')!)).not.toContain('never-share-this-token');
    expect(decodeURIComponent(whatsapp.getAttribute('href')!)).toContain('/booking/41');
  });
  test('floating support stays clear while the composer is visible, including after blur', () => {
    let reportVisibility!: IntersectionObserverCallback;
    const observe = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { reportVisibility = callback; }
      observe = observe;
      disconnect = vi.fn();
    });
    render(<MemoryRouter><SupportWidget /><div data-testid="guest-message-composer"><textarea aria-label="Compose" /><button type="button">Send message</button></div><button type="button">Outside message</button></MemoryRouter>);
    expect(screen.getByRole('button', { name: /chat with us/i })).toBeVisible();
    expect(observe).toHaveBeenCalledWith(screen.getByTestId('guest-message-composer'));
    act(() => reportVisibility([{ target: screen.getByTestId('guest-message-composer'), isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    act(() => screen.getByRole('textbox', { name: 'Compose' }).focus());
    expect(screen.queryByRole('button', { name: /chat with us/i })).not.toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'Outside message' }).focus());
    expect(screen.queryByRole('button', { name: /chat with us/i })).not.toBeInTheDocument();
    act(() => reportVisibility([{ target: screen.getByTestId('guest-message-composer'), isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getByRole('button', { name: /chat with us/i })).toBeVisible();
  });
  test('GUEST-005 protects both the checkout briefing and composer until both leave the viewport', () => {
    let reportVisibility!: IntersectionObserverCallback;
    const observe = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { reportVisibility = callback; }
      observe = observe;
      disconnect = vi.fn();
    });
    render(<MemoryRouter><SupportWidget /><section data-testid="checkout-briefing">Return the keys.</section><div data-testid="guest-message-composer">Composer</div></MemoryRouter>);
    const briefing = screen.getByTestId('checkout-briefing');
    const composer = screen.getByTestId('guest-message-composer');
    expect(observe).toHaveBeenCalledWith(briefing);
    expect(observe).toHaveBeenCalledWith(composer);
    const report = (target: Element, isIntersecting: boolean) => act(() => reportVisibility([{ target, isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));
    report(briefing, true);
    report(composer, false);
    expect(screen.queryByRole('button', { name: /chat with us/i })).not.toBeInTheDocument();
    report(composer, true);
    report(briefing, false);
    expect(screen.queryByRole('button', { name: /chat with us/i })).not.toBeInTheDocument();
    report(composer, false);
    expect(screen.getByRole('button', { name: /chat with us/i })).toBeVisible();
  });
});
