/**
 * @vitest-environment jsdom
 *
 * axe label-content-name-mismatch on the /search page (TASK-1188): the promo-code button's
 * aria-label ("Copy promo code DIRECT5") did not contain its visible text ("DIRECT5 Copy").
 * The accessible name must start with what is shown.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import DirectDiscountBanner from './DirectDiscountBanner';
import { settle } from '@/test/settle';

vi.mock('@/hooks/useAdvertisedPromoActive', () => ({
  useAdvertisedPromoActive: () => 'active',
}));

beforeEach(() => {
  sessionStorage.clear();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

function visibleText(el: HTMLElement): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('DirectDiscountBanner promo button accessible name', () => {
  it('starts with its visible text, before and after copying', async () => {
    render(<DirectDiscountBanner />);
    await settle();
    const btn = screen.getByTestId('direct-discount-banner').querySelector<HTMLButtonElement>('button[title="Click to copy"]')!;
    expect(visibleText(btn)).toBe('DIRECT5 Copy');
    expect(btn.getAttribute('aria-label')!.startsWith(visibleText(btn))).toBe(true);

    fireEvent.click(btn);
    await settle();
    expect(visibleText(btn)).toBe('DIRECT5 Copied!');
    expect(btn.getAttribute('aria-label')!.startsWith(visibleText(btn))).toBe(true);
  });
});
