import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GuestMessageThread from './GuestMessageThread';
import {
  fetchGuestMessages,
  fetchGuestTypingState,
  sendGuestMessage,
  sendGuestTypingHeartbeat,
} from '@/api/guestMessagesClient';
import { settle } from '../../test/settle';

vi.mock('@/api/guestMessagesClient', () => ({
  fetchGuestMessages: vi.fn(),
  fetchGuestTypingState: vi.fn(),
  sendGuestMessage: vi.fn(),
  sendGuestTypingHeartbeat: vi.fn(),
}));

describe('GuestMessageThread GUEST-015 (photos) & GUEST-017 (reply guidance + urgent call)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchGuestMessages).mockResolvedValue({
      conversationId: 10,
      messages: [
        {
          id: 1,
          sender: 'Guest',
          body: 'Gate photo attached',
          sentAtUtc: '2026-10-17T08:00:00Z',
          photos: ['data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'],
        },
      ],
    });
    vi.mocked(fetchGuestTypingState).mockResolvedValue({ hostTyping: false, guestTyping: false });
    vi.mocked(sendGuestTypingHeartbeat).mockResolvedValue({ hostTyping: false, guestTyping: true });
    vi.mocked(sendGuestMessage).mockImplementation(async (_b, _t, body, photos) => ({
      id: 2,
      sender: 'Guest',
      body,
      sentAtUtc: new Date().toISOString(),
      photos,
    }));
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('GUEST-017: renders reply-time guidance and urgent tel: link when hostPhone is provided', async () => {
    render(<GuestMessageThread bookingId={99} token="tok-1" hostPhone="+91 98765 43210" />);
    await settle();

    expect(screen.getByTestId('guest-message-reply-guidance')).toHaveTextContent(
      /Typical host reply time: under 1 hour during daytime/i,
    );
    const callLink = screen.getByTestId('guest-message-urgent-call');
    expect(callLink).toHaveAttribute('href', 'tel:+919876543210');
  });

  it('GUEST-015: renders message photo thumbnails and opens lightbox on click', async () => {
    render(<GuestMessageThread bookingId={99} token="tok-1" />);
    await settle();

    const thumb = screen.getByTestId('guest-message-photo-thumb');
    expect(thumb).toBeInTheDocument();
    fireEvent.click(thumb);

    expect(screen.getByTestId('guest-message-photo-lightbox')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('guest-message-photo-lightbox-close'));
    expect(screen.queryByTestId('guest-message-photo-lightbox')).not.toBeInTheDocument();
  });

  it('GUEST-015: attaches a photo file, previews it, and sends it with sendGuestMessage', async () => {
    render(<GuestMessageThread bookingId={99} token="tok-1" />);
    await settle();

    const file = new File(['fake-image-bytes'], 'gate.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('guest-message-photo-input');
    fireEvent.change(fileInput, { target: { files: [file] } });
    await settle();
    await new Promise((r) => setTimeout(r, 20));
    await settle();

    expect(screen.getByTestId('guest-message-photo-preview')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('guest-message-send'));
    await settle();

    expect(sendGuestMessage).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(sendGuestMessage).mock.calls[0];
    expect(callArgs[0]).toBe(99);
    expect(callArgs[1]).toBe('tok-1');
    expect(callArgs[2]).toContain('Photo attachment');
    expect(Array.isArray(callArgs[3])).toBe(true);
    expect(callArgs[3]?.length).toBe(1);
  });
});
