import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchGuestMessages,
  sendGuestMessage,
  type GuestConversationMessage,
} from "@/api/guestMessagesClient";

/** TASK-4333: polling cadence for the guest message thread (matches admin ConversationsPage.tsx). */
const POLL_INTERVAL_MS = 30_000;
const MAX_MESSAGE_LENGTH = 2000;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

/**
 * TASK-4333: "Messages" section on the booking confirmation page. Read + reply to the host,
 * reusing the page's existing per-booking `?t=` token. Request/refresh based (no websocket) —
 * polls on a timer like the admin inbox, and re-fetches immediately after a successful send.
 */
export default function GuestMessageThread({ bookingId, token }: { bookingId: number; token: string }) {
  const [messages, setMessages] = useState<GuestConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const thread = await fetchGuestMessages(bookingId, token, signal);
        // Defensive: a malformed/partial payload (missing `messages`) must not white-screen
        // the confirmation page — fall back to an empty thread. (TASK-4333 hardening)
        setMessages(thread?.messages ?? []);
        setLoadError(null);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        console.error("Failed to load guest message thread:", err);
        setLoadError("Couldn't load messages. Please try again shortly.");
      } finally {
        setLoading(false);
      }
    },
    [bookingId, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const interval = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const sent = await sendGuestMessage(bookingId, token, trimmed);
      setMessages((prev) => [...prev, sent]);
      setDraft("");
    } catch (err) {
      console.error("Failed to send guest message:", err);
      setSendError("Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3" data-testid="guest-message-thread">
      <h2 className="text-sm font-semibold text-text-primary">Messages</h2>
      <p className="text-sm text-text-secondary">Ask your host a question or read past replies.</p>

      {loading ? (
        <p className="text-sm text-text-secondary" data-testid="guest-messages-loading">Loading messages…</p>
      ) : loadError ? (
        <p className="text-sm text-red-600" role="alert" data-testid="guest-messages-error">{loadError}</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-text-secondary" data-testid="guest-messages-empty">
          No messages yet. Send your host a question below.
        </p>
      ) : (
        <div className="max-h-80 overflow-y-auto space-y-2 pr-1" data-testid="guest-messages-list">
          {messages.map((m) => {
            const isGuest = m.sender === "Guest";
            return (
              <div
                key={m.id}
                className={`flex ${isGuest ? "justify-end" : "justify-start"}`}
                data-testid="guest-message-item"
                data-sender={m.sender}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    isGuest ? "bg-brand-primary text-white" : "bg-bg-muted text-text-primary"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-[11px] ${isGuest ? "text-white/75" : "text-text-secondary"}`}>
                    {isGuest ? "You" : "Host"} · {formatTime(m.sentAtUtc)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={threadEndRef} />
        </div>
      )}

      {sendError && (
        <p className="text-sm text-red-600" role="alert" data-testid="guest-message-send-error">
          {sendError}
        </p>
      )}

      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Type a message to your host…"
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          className="flex-1 rounded-lg border border-border-subtle px-3 py-2 text-sm resize-none"
          data-testid="guest-message-input"
        />
        <button
          type="button"
          disabled={sending || !draft.trim()}
          onClick={() => void handleSend()}
          className="inline-flex items-center justify-center rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-2 hover:bg-brand-primary/90 transition-colors disabled:opacity-50 self-end"
          data-testid="guest-message-send"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
