import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import GuestMessageThread from './GuestMessageThread';
import { fetchGuestMessages, fetchGuestTypingState, sendGuestMessage, sendGuestTypingHeartbeat } from '@/api/guestMessagesClient';

vi.mock('@/api/guestMessagesClient', () => ({
  fetchGuestMessages: vi.fn(), fetchGuestTypingState: vi.fn(),
  sendGuestMessage: vi.fn(), sendGuestTypingHeartbeat: vi.fn(),
}));
const send = vi.mocked(sendGuestMessage);
const result = (body = 'Sent') => ({ id: 5, sender: 'Guest', body, sentAtUtc: new Date().toISOString() });
const input = () => screen.getByTestId('guest-message-input');
const category = () => screen.getByRole('combobox', { name: 'Message category' });
const button = () => screen.getByTestId('guest-message-send');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchGuestMessages).mockResolvedValue({ conversationId: null, messages: [] });
  vi.mocked(fetchGuestTypingState).mockResolvedValue({ hostTyping: false, guestTyping: false });
  vi.mocked(sendGuestTypingHeartbeat).mockResolvedValue({ hostTyping: false, guestTyping: true });
  send.mockResolvedValue(result());
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('GUEST-006 categorized stay messages', () => {
  test.each(['Maintenance', 'Cleanliness', 'Access', 'Noise', 'Other'])('%s only prefixes an explicitly sent message', async (label) => {
    render(<GuestMessageThread bookingId={41} token="private-booking-token" issueCategory={label.toLowerCase()} issueRequestKey="one" />);
    await waitFor(() => expect(category()).toHaveValue(label.toLowerCase()));
    expect(send).not.toHaveBeenCalled();
    fireEvent.change(input(), { target: { value: 'Please help with this issue.' } });
    fireEvent.click(button());
    await waitFor(() => expect(send).toHaveBeenCalledWith(41, 'private-booking-token', `[${label}] Please help with this issue.`));
    await waitFor(() => expect(input()).toHaveValue(''));
    expect(category()).toHaveValue('');
  });

  test('an unknown category leaves ordinary messages unchanged', async () => {
    render(<GuestMessageThread bookingId={41} token="t" issueCategory="injected-category" />);
    await screen.findByTestId('guest-messages-empty');
    fireEvent.change(input(), { target: { value: '  A normal question  ' } });
    fireEvent.click(button());
    await waitFor(() => expect(send).toHaveBeenCalledWith(41, 't', 'A normal question'));
  });

  test('a new drawer request can select the same category again after sending', async () => {
    const view = render(<GuestMessageThread bookingId={41} token="t" issueCategory="other" issueRequestKey="one" />);
    await waitFor(() => expect(category()).toHaveValue('other'));
    fireEvent.change(input(), { target: { value: 'First issue' } });
    fireEvent.click(button());
    await waitFor(() => expect(category()).toHaveValue(''));
    view.rerender(<GuestMessageThread bookingId={41} token="t" issueCategory="other" issueRequestKey="two" />);
    await waitFor(() => expect(category()).toHaveValue('other'));
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('failure preserves category and text; rapid Enter/click cannot double-send', async () => {
    let rejectSend!: (error: Error) => void;
    send.mockImplementation(() => new Promise((_, reject) => { rejectSend = reject; }));
    render(<GuestMessageThread bookingId={41} token="t" issueCategory="access" />);
    await waitFor(() => expect(category()).toHaveValue('access'));
    fireEvent.change(input(), { target: { value: 'The key is not working.' } });
    act(() => {
      fireEvent.keyDown(input(), { key: 'Enter' });
      fireEvent.keyDown(input(), { key: 'Enter', repeat: true });
      fireEvent.click(button());
    });
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => rejectSend(new Error('Network unavailable')));
    expect(await screen.findByTestId('guest-message-send-error')).toBeVisible();
    expect(input()).toHaveValue('The key is not working.');
    expect(category()).toHaveValue('access');
  });

  test('the 2000 character body limit includes the category without truncating an existing draft', async () => {
    render(<GuestMessageThread bookingId={41} token="t" />);
    await screen.findByTestId('guest-messages-empty');
    fireEvent.change(input(), { target: { value: 'x'.repeat(2000) } });
    fireEvent.change(category(), { target: { value: 'maintenance' } });
    expect(input()).toHaveValue('x'.repeat(2000));
    expect(button()).toBeDisabled();
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(send).not.toHaveBeenCalled();
    fireEvent.change(input(), { target: { value: 'x'.repeat(1986) } });
    fireEvent.click(button());
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][2]).toHaveLength(2000);
  });

  test.each([{ bookingId: 42, token: 't' }, { bookingId: 41, token: 'new-token' }])('booking/token changes discard old drafts and ignore late send results: %j', async (next) => {
    let resolveSend!: (value: ReturnType<typeof result>) => void;
    send.mockImplementation(() => new Promise((resolve) => { resolveSend = resolve; }));
    const view = render(<GuestMessageThread bookingId={41} token="t" issueCategory="noise" />);
    await waitFor(() => expect(category()).toHaveValue('noise'));
    fireEvent.change(input(), { target: { value: 'Private old stay issue' } });
    fireEvent.click(button());
    view.rerender(<GuestMessageThread {...next} />);
    await screen.findByTestId('guest-messages-empty');
    expect(input()).toHaveValue('');
    expect(category()).toHaveValue('');
    await act(async () => resolveSend(result('Private old stay issue')));
    expect(screen.queryByText('Private old stay issue')).not.toBeInTheDocument();
    expect(button()).toBeDisabled();
  });
});
