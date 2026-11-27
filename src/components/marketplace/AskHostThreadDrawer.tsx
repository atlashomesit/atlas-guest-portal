import React, { useEffect, useId, useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { buildApiUrl } from '@/api/client';

export type InquiryMessage = {
  id: string;
  sender: 'guest' | 'host';
  body: string;
  createdAt: string;
};

type StoredThread = {
  threadToken: string;
  guestName: string;
  messages: InquiryMessage[];
};

export interface AskHostThreadDrawerProps {
  open: boolean;
  onClose: () => void;
  listingId: number | string;
  listingTitle: string;
  hostName?: string;
  tenantSlug?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number | null;
}

function storageKey(tenantSlug: string | undefined, listingId: number | string): string {
  return `atlas_mkt_inquiry_${tenantSlug || 'default'}_${listingId}`;
}

function readStoredThread(key: string): StoredThread | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredThread;
    if (parsed && typeof parsed.threadToken === 'string' && Array.isArray(parsed.messages)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredThread(key: string, thread: StoredThread): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(thread));
  } catch {
    // Ignore storage quota errors
  }
}

export const AskHostThreadDrawer: React.FC<AskHostThreadDrawerProps> = ({
  open,
  onClose,
  listingId,
  listingTitle,
  hostName = 'the host',
  tenantSlug,
  checkIn,
  checkOut,
  guests,
}) => {
  const titleId = useId();
  const key = storageKey(tenantSlug, listingId);

  const [threadToken, setThreadToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');
  const [question, setQuestion] = useState('');
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const saved = readStoredThread(key);
    if (saved) {
      setThreadToken(saved.threadToken);
      setGuestName(saved.guestName);
      setMessages(saved.messages);
    } else {
      setThreadToken(null);
      setMessages([]);
    }
  }, [open, key]);

  useEffect(() => {
    if (!open || !threadToken || threadToken.startsWith('local-')) return;
    let cancelled = false;
    fetch(buildApiUrl(`/marketplace/inquiries/${encodeURIComponent(threadToken)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.messages)) return;
        const serverMsgs: InquiryMessage[] = data.messages.map(
          (m: { id?: string | number; sender?: string; body?: string; createdAt?: string }, idx: number) => ({
            id: String(m.id ?? idx),
            sender: m.sender === 'host' ? 'host' : 'guest',
            body: String(m.body ?? ''),
            createdAt: m.createdAt ?? new Date().toISOString(),
          }),
        );
        setMessages(serverMsgs);
        writeStoredThread(key, { threadToken, guestName, messages: serverMsgs });
      })
      .catch(() => {
        // Keep local cache if offline
      });
    return () => {
      cancelled = true;
    };
  }, [open, threadToken, key, guestName]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleStartThread = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = guestName.trim();
    const trimmedContact = guestContact.trim();
    const trimmedQuestion = question.trim();
    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }
    if (!trimmedContact) {
      setError('Please enter an email or phone number so we can notify you when the host replies.');
      return;
    }
    if (!trimmedQuestion) {
      setError('Please write your question for the host.');
      return;
    }

    setError(null);
    setSubmitting(true);

    const optimisticMsg: InquiryMessage = {
      id: `msg-${Date.now()}`,
      sender: 'guest',
      body: trimmedQuestion,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(buildApiUrl('/marketplace/inquiries'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: Number(listingId) || listingId,
          tenantSlug: tenantSlug || undefined,
          guestName: trimmedName,
          guestEmail: trimmedContact.includes('@') ? trimmedContact : undefined,
          guestPhone: !trimmedContact.includes('@') ? trimmedContact : undefined,
          checkIn: checkIn || undefined,
          checkOut: checkOut || undefined,
          guests: guests || undefined,
          question: trimmedQuestion,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const token = String(data?.threadToken || `local-${Date.now()}`);
        const serverMsgs: InquiryMessage[] = Array.isArray(data?.messages)
          ? data.messages
          : [optimisticMsg];
        setThreadToken(token);
        setMessages(serverMsgs);
        setQuestion('');
        writeStoredThread(key, { threadToken: token, guestName: trimmedName, messages: serverMsgs });
      } else {
        const fallbackToken = `local-${Date.now()}`;
        const nextMsgs = [optimisticMsg];
        setThreadToken(fallbackToken);
        setMessages(nextMsgs);
        setQuestion('');
        writeStoredThread(key, { threadToken: fallbackToken, guestName: trimmedName, messages: nextMsgs });
      }
    } catch {
      const fallbackToken = `local-${Date.now()}`;
      const nextMsgs = [optimisticMsg];
      setThreadToken(fallbackToken);
      setMessages(nextMsgs);
      setQuestion('');
      writeStoredThread(key, { threadToken: fallbackToken, guestName: trimmedName, messages: nextMsgs });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || !threadToken) return;
    setError(null);
    setSubmitting(true);

    const nextMsg: InquiryMessage = {
      id: `msg-${Date.now()}`,
      sender: 'guest',
      body: trimmed,
      createdAt: new Date().toISOString(),
    };
    const nextMsgs = [...messages, nextMsg];
    setMessages(nextMsgs);
    setReplyText('');
    writeStoredThread(key, { threadToken, guestName, messages: nextMsgs });

    if (!threadToken.startsWith('local-')) {
      try {
        await fetch(buildApiUrl(`/marketplace/inquiries/${encodeURIComponent(threadToken)}/messages`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: trimmed }),
        });
      } catch {
        // Already persisted locally
      }
    }
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="presentation"
      onClick={onClose}
      data-testid="ask-host-drawer-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="ask-host-drawer"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold text-neutral-900">
              <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
              Ask {hostName}
            </h2>
            <p className="truncate text-xs text-neutral-500">{listingTitle}</p>
          </div>
          <button
            type="button"
            aria-label="Close Ask the host drawer"
            data-testid="ask-host-drawer-close"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-xs text-neutral-600">
          Typically replies within a few hours · Stay right on atlastays.com without sharing your personal WhatsApp number.
          {checkIn && checkOut && (
            <span className="mt-1 block font-medium text-neutral-800">
              Trip context: {checkIn} to {checkOut}{guests ? ` · ${guests} guests` : ''}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!threadToken ? (
            <form onSubmit={handleStartThread} className="flex flex-col gap-3" data-testid="ask-host-start-form">
              <div>
                <label htmlFor="ask-host-name" className="mb-1 block text-xs font-semibold text-neutral-800">
                  Your name
                </label>
                <input
                  id="ask-host-name"
                  data-testid="ask-host-name"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Ananya"
                  maxLength={80}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="ask-host-contact" className="mb-1 block text-xs font-semibold text-neutral-800">
                  Email or phone (for reply alerts)
                </label>
                <input
                  id="ask-host-contact"
                  data-testid="ask-host-contact"
                  type="text"
                  value={guestContact}
                  onChange={(e) => setGuestContact(e.target.value)}
                  placeholder="you@example.com or +91..."
                  maxLength={120}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="ask-host-question" className="mb-1 block text-xs font-semibold text-neutral-800">
                  Your question
                </label>
                <textarea
                  id="ask-host-question"
                  data-testid="ask-host-question"
                  rows={4}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about early check-in, parking height, inverter backup, kitchen utensils..."
                  maxLength={1000}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-black focus:outline-none"
                />
              </div>

              {error && (
                <p role="alert" className="text-xs font-medium text-red-600" data-testid="ask-host-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                data-testid="ask-host-submit"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden />
                {submitting ? 'Sending…' : 'Send question'}
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-3" data-testid="ask-host-thread-messages">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  data-testid={`ask-host-msg-${msg.sender}`}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.sender === 'guest'
                      ? 'self-end bg-black text-white'
                      : 'self-start border border-neutral-200 bg-neutral-100 text-neutral-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {threadToken && (
          <form
            onSubmit={handleSendReply}
            className="flex items-center gap-2 border-t border-neutral-200 p-3"
            data-testid="ask-host-reply-form"
          >
            <input
              type="text"
              aria-label="Write a follow-up message"
              data-testid="ask-host-reply-input"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a follow-up…"
              maxLength={1000}
              className="min-h-[44px] flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-black focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting || !replyText.trim()}
              data-testid="ask-host-reply-submit"
              aria-label="Send reply"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-black px-3 text-white hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AskHostThreadDrawer;
