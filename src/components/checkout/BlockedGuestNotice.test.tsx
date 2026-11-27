import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockedGuestNotice, isBlockedGuestError } from './BlockedGuestNotice';

describe('BNB-040 BlockedGuestNotice', () => {
  it('detects blocked guest error codes and 403 restricted responses', () => {
    expect(isBlockedGuestError(403, { code: 'GUEST_BLOCKED' })).toBe(true);
    expect(isBlockedGuestError(400, { errorCode: 'DO_NOT_RENT' })).toBe(true);
    expect(isBlockedGuestError(403, { message: 'Guest is on do-not-rent list' })).toBe(true);
    expect(isBlockedGuestError(400, { code: 'INVALID_DATES' })).toBe(false);
  });

  it('renders polite host contact options without exposing internal blocklist jargon', () => {
    const onDismiss = vi.fn();
    render(
      <BlockedGuestNotice
        propertyName="Coorg Hilltop Villa"
        hostPhone="+91 98765 43210"
        hostEmail="host@coorgvilla.in"
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByTestId('blocked-guest-notice')).toBeTruthy();
    expect(screen.getByText(/Coorg Hilltop Villa/i)).toBeTruthy();
    expect(screen.getByText(/Call host/i)).toBeTruthy();
    expect(screen.getByText(/Email host/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/Back to stay details/i));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
