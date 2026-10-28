import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settle } from '../test/settle';
import GuestAssistant from './GuestAssistant';
import {
  LISTING_FAQ_BODY_ATTR,
  OPEN_LISTING_FAQ_EVENT,
} from './property/propertyHelpEvents';

function stubFaqs(entries: Array<{ q: string; a: string }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => entries }),
  );
}

describe('GuestAssistant reachable from the phone sticky bar (TOP10 review fix)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.removeAttribute(LISTING_FAQ_BODY_ATTR);
  });

  it('advertises the listing FAQs on <body> only while it has FAQs, and clears it on unmount', async () => {
    stubFaqs([{ q: 'Is parking free?', a: 'Yes.' }]);
    const { unmount } = render(<GuestAssistant listingId={42} />);
    await settle();
    expect(document.body).toHaveAttribute(LISTING_FAQ_BODY_ATTR, 'true');
    unmount();
    expect(document.body).not.toHaveAttribute(LISTING_FAQ_BODY_ATTR);
  });

  it('does not advertise (and ignores the open event) when the listing has no FAQs', async () => {
    stubFaqs([]);
    render(<GuestAssistant listingId={42} />);
    await settle();
    expect(document.body).not.toHaveAttribute(LISTING_FAQ_BODY_ATTR);
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_LISTING_FAQ_EVENT));
    });
    expect(screen.queryByRole('dialog', { name: /listing faq/i })).not.toBeInTheDocument();
  });

  it('opens the listing FAQ panel when the sticky bar chooser asks for it', async () => {
    stubFaqs([{ q: 'Is parking free?', a: 'Yes, on site.' }]);
    render(<GuestAssistant listingId={42} />);
    await settle();
    expect(screen.queryByRole('dialog', { name: /listing faq/i })).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_LISTING_FAQ_EVENT));
    });
    expect(screen.getByRole('dialog', { name: /listing faq/i })).toBeInTheDocument();
    expect(screen.getByText('Is parking free?')).toBeInTheDocument();
  });

  it('stacks the FAQ sheet and its backdrop above the sticky bar (z-index 50) so the bar never covers it', async () => {
    stubFaqs([{ q: 'Is parking free?', a: 'Yes.' }]);
    render(<GuestAssistant listingId={42} />);
    await settle();
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_LISTING_FAQ_EVENT));
    });
    const dialog = screen.getByRole('dialog', { name: /listing faq/i });
    expect(dialog.className).toContain('z-[calc(var(--z-modal)+2)]');
    const backdrop = dialog.previousElementSibling as HTMLElement;
    expect(backdrop.className).toContain('z-[calc(var(--z-modal)+1)]');
  });
});
