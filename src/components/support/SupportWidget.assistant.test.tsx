import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import * as featureFlags from '../../config/featureFlags';
import SupportWidget from './SupportWidget';

const ChangeListing = () => {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate('/homes/quiet-house/272?tenant=quiet-house')}>Next listing</button>;
};

const open = (route = '/homes/quiet-house/271?tenant=quiet-house', hideChatbot = true) => {
  window.history.replaceState(null, '', route);
  vi.spyOn(featureFlags, 'getFeatureFlags').mockReturnValue({ ...featureFlags.defaultFeatureFlags, enableHideUnfinishedChatbot: hideChatbot });
  render(<MemoryRouter initialEntries={[route]}><SupportWidget /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /chat with us/i }));
};

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

describe('GUEST-004 Stay assistant', () => {
  test.each([true, false])('both flag states expose one working assistant entry; flag=%s', (hideChatbot) => {
    open(undefined, hideChatbot);
    const entry = screen.getByRole('button', { name: /stay assistant/i });
    expect(screen.getAllByRole('button', { name: /stay assistant/i })).toHaveLength(1);
    entry.focus();
    fireEvent.click(entry);
    expect(screen.getByRole('heading', { name: /stay assistant/i })).toBeVisible();
    expect(screen.getByRole('textbox', { name: /ask the stay assistant/i })).toHaveFocus();
    expect(screen.getByText(/automated help from stay FAQs and AI/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /back to support/i }));
    expect(screen.getByRole('button', { name: /stay assistant/i })).toHaveFocus();
  });

  test('sends listing ID and tenant header once, and labels an FAQ reply', async () => {
    let resolve!: (value: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => { resolve = r; }));
    vi.stubGlobal('fetch', fetchMock);
    open();
    fireEvent.click(screen.getByRole('button', { name: /stay assistant/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /ask the stay assistant/i }), { target: { value: 'Parking?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByRole('textbox', { name: /ask the stay assistant/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start voice input' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/api/public/chat');
    expect(init.headers).toMatchObject({ 'X-Tenant-Slug': 'quiet-house' });
    expect(JSON.parse(init.body as string)).toEqual({ listingId: 271, message: 'Parking?' });
    resolve({ ok: true, json: async () => ({ reply: 'Parking is available.', source: 'faq' }) } as Response);
    expect(await screen.findByText('Parking is available.')).toBeVisible();
    expect(screen.getByText(/FAQ answer/i)).toBeVisible();
  });

  test('failure keeps the question editable for retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    open('/faq');
    fireEvent.click(screen.getByRole('button', { name: /stay assistant/i }));
    const input = screen.getByRole('textbox', { name: /ask the stay assistant/i });
    fireEvent.change(input, { target: { value: 'Can I check in early?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not get an answer/i));
    expect(input).toHaveValue('Can I check in early?');
    expect(input).toBeEnabled();
    expect(input).toHaveFocus();
  });

  test('voice input fills a draft without sending, and stops when leaving the assistant', () => {
    const start = vi.fn();
    const stop = vi.fn();
    let recognition!: SpeechRecognition;
    vi.stubGlobal('SpeechRecognition', class {
      start = start;
      stop = stop;
      constructor() { recognition = this as unknown as SpeechRecognition; }
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    open();
    fireEvent.click(screen.getByRole('button', { name: /stay assistant/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Start voice input' }));
    expect(start).toHaveBeenCalledOnce();
    const result = { results: [[{ transcript: 'Parking?' }]] } as unknown as SpeechRecognitionEvent;
    act(() => recognition.onresult?.(result));
    expect(screen.getByRole('textbox', { name: /ask the stay assistant/i })).toHaveValue('Parking?');
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /back to support/i }));
    expect(stop).toHaveBeenCalledOnce();
    recognition.onresult?.(result);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('switching listing aborts an in-flight answer and starts an empty transcript', () => {
    let pendingSignal!: AbortSignal;
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => {
      pendingSignal = init.signal as AbortSignal;
      return new Promise<Response>(() => {});
    }));
    vi.spyOn(featureFlags, 'getFeatureFlags').mockReturnValue(featureFlags.defaultFeatureFlags);
    window.history.replaceState(null, '', '/homes/quiet-house/271?tenant=quiet-house');
    render(<MemoryRouter initialEntries={['/homes/quiet-house/271?tenant=quiet-house']}><SupportWidget /><ChangeListing /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /chat with us/i }));
    fireEvent.click(screen.getByRole('button', { name: /stay assistant/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /ask the stay assistant/i }), { target: { value: 'Old listing?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(pendingSignal.aborted).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Next listing' }));
    expect(pendingSignal.aborted).toBe(true);
    expect(screen.getByRole('textbox', { name: /ask the stay assistant/i })).toHaveValue('');
  });

  test('rejects oversized draft and invalid listing primary keys before request payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'Help', source: 'faq' }) });
    vi.stubGlobal('fetch', fetchMock);
    open('/homes/quiet-house/9007199254740992?tenant=quiet-house');
    fireEvent.click(screen.getByRole('button', { name: /stay assistant/i }));
    const input = screen.getByRole('textbox', { name: /ask the stay assistant/i });
    fireEvent.change(input, { target: { value: 'x'.repeat(2001) } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/2,000 characters/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Help')).toBeVisible();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ listingId: null, message: 'Hello' });
  });

  test.each([
    ['ai', 'Automated answer'],
    ['fallback', 'General guidance'],
  ])('labels %s replies without implying a human answered', async (source, label) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'Please check with the host.', source }) }));
    open('/faq');
    fireEvent.click(screen.getByRole('button', { name: /stay assistant/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /ask the stay assistant/i }), { target: { value: 'Question?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Please check with the host.')).toBeVisible();
    expect(screen.getByText(label)).toBeVisible();
  });
});
