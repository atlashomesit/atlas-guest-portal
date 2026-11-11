/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HouseRulesAcceptPage from './HouseRulesAcceptPage';
import { settle } from '../test/settle';

vi.mock('../api/client', () => ({
  buildApiUrl: (path: string) => `https://api.example.test${path}`,
  getApiHeaders: () => ({}),
}));

const renderPage = (path = '/house-rules/BR-1?lastName=Guest') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/house-rules/:bookingRef" element={<HouseRulesAcceptPage />} /></Routes>
  </MemoryRouter>,
);

const pendingNotYetAccepted = {
  bookingRef: 'BR-1',
  listingName: 'Beach House',
  houseRulesText: 'No loud music after 10pm.',
  houseRulesPdfUrl: null,
  alreadyAccepted: false,
  acceptedAtUtc: null,
  bookingStatus: 'lead',
};

describe('HouseRulesAcceptPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // TASK-10174 (the harder half, not a11y): handleAccept failing used to set `error`, which
  // was gated with `!error` alongside `data` -- so the ENTIRE house-rules block (rules text +
  // Accept button) unmounted, leaving only the error message with no retry control except a
  // full page reload. On a link a guest reached from an OTA email, that is a dead end.
  it('keeps the house rules and Accept button in the document after a failed accept, with a retry affordance', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/accept-house-rules')) {
        return new Response('Internal Server Error', { status: 500 });
      }
      return new Response(JSON.stringify(pendingNotYetAccepted), { status: 200 });
    }));

    renderPage();

    await settle();
    const acceptButton = screen.getByTestId('house-rules-accept');
    expect(screen.getByText(/No loud music after 10pm/)).toBeInTheDocument();

    fireEvent.click(acceptButton);

    await settle();
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't record your acceptance/i);

    // The defect: this used to be entirely gone from the document at this point.
    expect(screen.getByTestId('house-rules-accept')).toBeInTheDocument();
    expect(screen.getByText(/No loud music after 10pm/)).toBeInTheDocument();
    expect(screen.getByTestId('house-rules-accept')).not.toBeDisabled();

    // The SAME button is the retry control -- clicking it again should be able to succeed.
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/accept-house-rules')) {
        return new Response(JSON.stringify({ ...pendingNotYetAccepted, alreadyAccepted: true }), { status: 200 });
      }
      return new Response(JSON.stringify(pendingNotYetAccepted), { status: 200 });
    }));
    fireEvent.click(screen.getByTestId('house-rules-accept'));
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent(/accepted the House Rules/i);
  });

  // TASK-10174 a11y half: WCAG 4.1.3 -- swapping in the confirmation used to be a plain <div>
  // with no live region and no focus move, so a screen-reader guest who just accepted got
  // silence.
  it('announces the acceptance confirmation in a status region', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/accept-house-rules')) {
        return new Response(JSON.stringify({ ...pendingNotYetAccepted, alreadyAccepted: true }), { status: 200 });
      }
      return new Response(JSON.stringify(pendingNotYetAccepted), { status: 200 });
    }));

    renderPage();

    await settle();
    fireEvent.click(screen.getByTestId('house-rules-accept'));

    await settle();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/accepted the House Rules/i);
    // The focus move runs in a passive useEffect after the commit that mounts the banner, and
    // findByRole can resolve on that commit's DOM mutation before React flushes the effect
    // (seen under load on the 2026-09-28 release gate: focus still on <body>). Wait for it.
    await settle();
    expect(status).toHaveFocus();
  });
});

describe('HouseRulesAcceptPage after a 409 (G3 journey 11)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('says it cannot be accepted AND takes the Accept button away, showing the real outcome', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/accept-house-rules')) {
        return new Response(JSON.stringify({ error: 'HOUSE_RULES_NOT_PENDING', status: 'Confirmed', outcome: 'confirmed' }), { status: 409 });
      }
      return new Response(JSON.stringify(pendingNotYetAccepted), { status: 200 });
    }));

    renderPage();
    await settle();
    fireEvent.click(screen.getByTestId('house-rules-accept'));
    await settle();

    expect(screen.getByRole('alert')).toHaveTextContent(/no longer awaiting host approval/i);
    expect(screen.queryByTestId('house-rules-accept')).not.toBeInTheDocument();
    expect(screen.getByTestId('house-rules-outcome-confirmed')).toBeInTheDocument();
  });

  it('still takes the button away when the 409 has no readable body', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/accept-house-rules')) return new Response('conflict', { status: 409 });
      return new Response(JSON.stringify(pendingNotYetAccepted), { status: 200 });
    }));
    renderPage();
    await settle();
    fireEvent.click(screen.getByTestId('house-rules-accept'));
    await settle();
    expect(screen.getByRole('alert')).toHaveTextContent(/no longer awaiting host approval/i);
    expect(screen.queryByTestId('house-rules-accept')).not.toBeInTheDocument();
  });
});


describe('approved House Rules GET recovery', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it.each([503, 408, 429, 'network'])('retries temporary %s with the same credentials and focuses recovered rules without POST', async (failure) => {
    const fetchMock = vi.fn().mockImplementationOnce(() => {
      if (failure === 'network') return Promise.reject(new Error('offline'));
      return Promise.resolve(new Response('', { status: Number(failure) }));
    }).mockResolvedValue(new Response(JSON.stringify(pendingNotYetAccepted), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage('/house-rules/BR-1?lastName=O%26Guest&t=a%2Bb%26c');
    await settle();
    expect(screen.getByRole('alert')).toHaveTextContent('could not load');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await settle();
    expect(screen.getByRole('heading', { name: 'House Rules' })).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
    expect(fetchMock.mock.calls[1][0]).toContain('lastName=O%26Guest&t=a%2Bb%26c');
    expect(fetchMock.mock.calls.every((call) => !call[1]?.method)).toBe(true);
  });
  it.each([400, 401, 403, 404])('keeps %s terminal', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));
    renderPage(); await settle();
    expect(screen.getByRole('alert')).toHaveTextContent("couldn't find");
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
  it('does not request an incomplete link', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    renderPage('/house-rules/BR-1'); await settle();
    expect(screen.getByRole('alert')).toHaveTextContent('missing information');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});


describe('recovered House Rules outcome focus', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it.each(['confirmed', 'declined', 'pending'])('focuses an appropriate recovered %s outcome when already accepted', async (outcome) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...pendingNotYetAccepted, alreadyAccepted: true, outcome }), { status: 200 })));
    renderPage(); await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' })); await settle();
    if (outcome === 'pending') expect(screen.getByRole('status')).toHaveFocus();
    else expect(screen.getByRole('heading', { name: 'House Rules' })).toHaveFocus();
    expect(screen.queryByTestId('house-rules-accept')).not.toBeInTheDocument();
  });
});
