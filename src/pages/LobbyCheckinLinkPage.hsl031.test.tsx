/** @vitest-environment jsdom */

/**
 * HSL-031: the lobby poster page. A shared screen: it always shows the same neutral sentence, never draws anything private, clears what was typed the moment it is
 * used, resets itself after 30 seconds idle, and keeps nothing in browser storage.
 */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LobbyCheckinLinkPage, { LOBBY_IDLE_RESET_MS } from './LobbyCheckinLinkPage';
import { settle } from '../test/settle';

vi.mock('../api/client', () => ({
  buildApiUrl: (path: string) => `https://api.example.test${path}`,
  getApiHeaders: () => ({}),
}));

const NEUTRAL = 'If these match, we sent a message to the phone on your booking.';

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/lobby/0123456789abcdef0123456789abcdef']}>
      <Routes><Route path="/lobby/:token" element={<LobbyCheckinLinkPage />} /></Routes>
    </MemoryRouter>,
  );
}

function stubFetch(handlers: { page?: () => Response; request?: () => Response }) {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
    if (url.endsWith('/request-link')) return handlers.request?.() ?? jsonResponse({ message: NEUTRAL });
    return handlers.page?.() ?? jsonResponse({ propertyName: 'Backpackers Rest', available: true, frontDeskLine: '+919800011111' });
  }));
  return calls;
}

describe('LobbyCheckinLinkPage (HSL-031)', () => {
  beforeEach(() => { vi.useRealTimers(); });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('posts the reference and last name to the token address and shows only the neutral sentence, then clears the form', async () => {
    const calls = stubFetch({});
    renderPage();
    await settle();

    expect(screen.getByTestId('lobby-heading')).toHaveTextContent('Backpackers Rest');
    fireEvent.change(screen.getByTestId('lobby-ref'), { target: { value: 'BK-100' } });
    fireEvent.change(screen.getByTestId('lobby-lastname'), { target: { value: 'Sharma' } });
    fireEvent.click(screen.getByTestId('lobby-submit'));
    await settle();

    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe('https://api.example.test/api/public/checkin/lobby/0123456789abcdef0123456789abcdef/request-link');
    expect(JSON.parse(post.body!)).toEqual({ bookingRef: 'BK-100', lastName: 'Sharma' });
    expect(screen.getByTestId('lobby-message')).toHaveTextContent(NEUTRAL);
    expect((screen.getByTestId('lobby-ref') as HTMLInputElement).value).toBe('');
    expect((screen.getByTestId('lobby-lastname') as HTMLInputElement).value).toBe('');
    expect(document.body.textContent).not.toMatch(/Sharma|BK-100/);
  });

  it('keeps nothing about the booking in browser storage', async () => {
    stubFetch({});
    renderPage();
    await settle();
    fireEvent.change(screen.getByTestId('lobby-ref'), { target: { value: 'BK-100' } });
    fireEvent.change(screen.getByTestId('lobby-lastname'), { target: { value: 'Sharma' } });
    fireEvent.click(screen.getByTestId('lobby-submit'));
    await settle();

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('resets the typed details and the answer after 30 seconds without a touch', async () => {
    stubFetch({});
    renderPage();
    await settle();
    vi.useFakeTimers();
    fireEvent.change(screen.getByTestId('lobby-ref'), { target: { value: 'BK-100' } });
    fireEvent.change(screen.getByTestId('lobby-lastname'), { target: { value: 'Sharma' } });
    fireEvent.pointerDown(window);

    act(() => { vi.advanceTimersByTime(LOBBY_IDLE_RESET_MS - 1000); });
    expect((screen.getByTestId('lobby-ref') as HTMLInputElement).value).toBe('BK-100');
    act(() => { vi.advanceTimersByTime(1500); });
    expect((screen.getByTestId('lobby-ref') as HTMLInputElement).value).toBe('');
    expect((screen.getByTestId('lobby-lastname') as HTMLInputElement).value).toBe('');
  });

  it('says to ask the front desk when the property cannot send, and offers no form', async () => {
    stubFetch({ page: () => jsonResponse({ propertyName: 'Backpackers Rest', available: false, frontDeskLine: '+919800011111' }) });
    renderPage();
    await settle();

    expect(screen.getByTestId('lobby-unavailable')).toHaveTextContent('Ask the front desk: +919800011111');
    expect(screen.queryByTestId('lobby-form')).not.toBeInTheDocument();
  });

  it('an unknown poster address shows a plain page, never a form', async () => {
    stubFetch({ page: () => jsonResponse({}, 404) });
    renderPage();
    await settle();

    expect(screen.getByTestId('lobby-notfound')).toBeInTheDocument();
    expect(screen.queryByTestId('lobby-form')).not.toBeInTheDocument();
  });

  it('a 429 asks the guest to wait or ask the desk, and does not claim anything was sent', async () => {
    stubFetch({ request: () => jsonResponse({}, 429) });
    renderPage();
    await settle();
    fireEvent.change(screen.getByTestId('lobby-ref'), { target: { value: 'BK-100' } });
    fireEvent.change(screen.getByTestId('lobby-lastname'), { target: { value: 'Sharma' } });
    fireEvent.click(screen.getByTestId('lobby-submit'));
    await settle();

    expect(screen.getByTestId('lobby-problem')).toHaveTextContent('wait a few minutes');
    expect(screen.queryByTestId('lobby-message')).not.toBeInTheDocument();
  });

  it('the submit button stays off until both fields are filled', async () => {
    stubFetch({});
    renderPage();
    await settle();
    expect(screen.getByTestId('lobby-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('lobby-ref'), { target: { value: 'BK-100' } });
    expect(screen.getByTestId('lobby-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('lobby-lastname'), { target: { value: 'Sharma' } });
    expect(screen.getByTestId('lobby-submit')).toBeEnabled();
  });
});
