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
