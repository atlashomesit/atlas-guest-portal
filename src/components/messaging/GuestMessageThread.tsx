import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchGuestMessages,
  fetchGuestTypingState,
  sendGuestMessage,
  sendGuestTypingHeartbeat,
  type GuestConversationMessage,
} from "@/api/guestMessagesClient";
import { parseStayIssueCategory, STAY_ISSUE_CATEGORIES, stayIssuePrefix } from './stayIssueCategories';

/** TASK-4333: polling cadence for the guest message thread (matches admin ConversationsPage.tsx). */
const POLL_INTERVAL_MS = 30_000;
/** TASK-101313: short-poll cadence for the "Host typing…" presence indicator. */
const TYPING_POLL_INTERVAL_MS = 5_000;
/** TASK-101313: minimum gap between guest typing heartbeats while composing. */
const HEARTBEAT_THROTTLE_MS = 4_000;
const MAX_MESSAGE_LENGTH = 2000;
const NEAR_BOTTOM_PX = 24;

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

function isHostMessage(message: GuestConversationMessage): boolean {
  return message.sender !== "Guest";
}

function hostReplyAnnouncement(count: number): string {
  return count === 1 ? "New reply from your host" : `${count} new replies from your host`;
}

/**
 * TASK-101313: read-receipt tick state for the guest's own messages, derived from the
 * API's per-message `status` ("pending" | "sent" | "delivered" | "read" | "failed").
 * Unknown/absent status (older payloads) falls back to "sent" — never blank.
 */
type ReceiptState = "read" | "delivered" | "sent" | "failed";

function receiptState(status?: string): ReceiptState {
  if (status === "read") return "read";
  if (status === "delivered") return "delivered";
  if (status === "failed") return "failed";
  return "sent";
}

function receiptGlyph(state: ReceiptState): string {
  switch (state) {
    case "read":
    case "delivered":
      return "✓✓";
    case "failed":
      return "!";
    default:
      return "✓";
  }
}

function receiptClassName(state: ReceiptState): string {
  // Guest bubbles are brand-primary with white text — read ticks use sky for the
  // classic "blue double-tick", the rest stay in the white family for contrast.
  switch (state) {
    case "read":
      return "text-sky-300";
    case "failed":
      return "text-red-200";
    case "delivered":
      return "text-white/80";
    default:
      return "text-white/60";
  }
}

/**
 * TASK-4333: "Messages" section on the booking confirmation page. Read + reply to the host,
 * reusing the page's existing per-booking `?t=` token. Request/refresh based (no websocket) —
 * polls on a timer like the admin inbox, and re-fetches immediately after a successful send.
 *
 * TASK-10088: polite live-region announcement for a newly polled host reply; never auto-focus
 * and never pull a composing / manually-scrolled guest to the bottom.
 */
interface GuestMessageThreadProps {
  bookingId: number;
  token: string;
  issueCategory?: string | null;
  issueRequestKey?: string;
}

export default function GuestMessageThread(props: GuestMessageThreadProps) {
  // A different booking/link must never inherit another stay's draft, messages,
  // or a late response from its in-flight send.
  return <BookingMessageThread key={`${props.bookingId}:${props.token}`} {...props} />;
}

function BookingMessageThread({ bookingId, token, issueCategory, issueRequestKey }: GuestMessageThreadProps) {
  const [messages, setMessages] = useState<GuestConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState(() => parseStayIssueCategory(issueCategory));
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  /** TASK-101313: null until the first thread fetch resolves a conversation id. */
  const [conversationId, setConversationId] = useState<number | null>(null);
  /** TASK-101313: host-side typing presence from the short poll. */
  const [hostTyping, setHostTyping] = useState(false);
  const lastHeartbeatRef = useRef(0);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialLoadCompleteRef = useRef(false);
  const seenHostMessageIdsRef = useRef<Set<number>>(new Set());
  const isComposingRef = useRef(false);
  const stickToBottomRef = useRef(true);
  const pendingGuestSendRef = useRef(false);
  const sendingRef = useRef(false);
  const selectedIssue = parseStayIssueCategory(issueCategory);
  const prefix = stayIssuePrefix(category);
  const messageTooLong = prefix.length + draft.trim().length > MAX_MESSAGE_LENGTH;

  useEffect(() => {
    if (!selectedIssue || loading) return;
    setCategory(selectedIssue);
    // Run after drawer-close focus restoration, and only for a requested issue
    // deep link. Ordinary polling must never take focus from another control.
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [selectedIssue, issueRequestKey, loading]);

  const noteHostReplies = useCallback((incoming: GuestConversationMessage[]) => {
    const unseenHost = incoming.filter(
      (m) => isHostMessage(m) && !seenHostMessageIdsRef.current.has(m.id),
    );
    for (const m of incoming) {
      if (isHostMessage(m)) seenHostMessageIdsRef.current.add(m.id);
    }
    if (!initialLoadCompleteRef.current) {
      initialLoadCompleteRef.current = true;
      return;
    }
    if (unseenHost.length === 0) return;
    setLiveAnnouncement(hostReplyAnnouncement(unseenHost.length));
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const thread = await fetchGuestMessages(bookingId, token, signal);
        // Defensive: a malformed/partial payload (missing `messages`) must not white-screen
        // the confirmation page — fall back to an empty thread. (TASK-4333 hardening)
        const next = thread?.messages ?? [];
        setMessages(next);
        setHasUnreadMessages(thread?.hasUnreadMessages ?? false);
        setConversationId(thread?.conversationId ?? null);
        setLoadError(null);
        noteHostReplies(next);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        console.error("Failed to load guest message thread:", err);
        setLoadError("Couldn't load messages. Please try again shortly.");
      } finally {
        setLoading(false);
      }
    },
    [bookingId, token, noteHostReplies],
  );

  // TASK-102401: skip poll ticks while the tab is hidden — a backgrounded chat
  // must not burn battery/data polling for messages nobody is reading. The next
  // visible tick (or remount) refreshes immediately.
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const interval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void load();
    }, POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [load]);

  /**
   * TASK-101313: "Host typing…" presence via short poll. Only polls once a
   * conversation exists (no thread → nobody to type in it). Best-effort: a failed
   * poll clears to not-typing and never disturbs the message thread.
   */
  useEffect(() => {
    if (conversationId === null) {
      setHostTyping(false);
      return;
    }
    let cancelled = false;
    const pollTyping = async () => {
      try {
        const state = await fetchGuestTypingState(bookingId, token);
        if (!cancelled) setHostTyping(state.hostTyping === true);
      } catch {
        if (!cancelled) setHostTyping(false);
      }
    };
    void pollTyping();
    // TASK-102401: typing presence is ephemeral UI state — no reason to poll it
    // from a hidden tab.
    const interval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void pollTyping();
    }, TYPING_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [bookingId, token, conversationId]);

  useEffect(() => {
    const fromOwnSend = pendingGuestSendRef.current;
    pendingGuestSendRef.current = false;
    if (!fromOwnSend && (isComposingRef.current || !stickToBottomRef.current)) return;
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleThreadScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  };

  /**
   * TASK-101313: guest typing heartbeat while composing (throttled). Fire-and-forget —
   * presence is best-effort and must never surface an error for a keystroke.
   */
  const handleDraftChange = (value: string) => {
    const next = value.slice(0, MAX_MESSAGE_LENGTH);
    setDraft(next);
    if (!next.trim() || conversationId === null || sending) return;
    const now = Date.now();
    if (now - lastHeartbeatRef.current < HEARTBEAT_THROTTLE_MS) return;
    lastHeartbeatRef.current = now;
    void sendGuestTypingHeartbeat(bookingId, token).catch(() => {});
  };

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sendingRef.current || prefix.length + trimmed.length > MAX_MESSAGE_LENGTH) return;
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    try {
      const sent = await sendGuestMessage(bookingId, token, `${prefix}${trimmed}`);
      pendingGuestSendRef.current = true;
      stickToBottomRef.current = true;
      setMessages((prev) => [...prev, sent]);
      setDraft("");
      setCategory('');
    } catch (err) {
      console.error("Failed to send guest message:", err);
      setSendError("Couldn't send your message. Please try again.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <div id="guest-messages" className="scroll-mt-24 rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3" data-testid="guest-message-thread">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Host reply announcements"
        className="sr-only"
        data-testid="guest-messages-live-region"
      >
        {liveAnnouncement}
      </div>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Messages</h2>
        {hasUnreadMessages && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full" data-testid="messages-unread-badge">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            New reply
          </span>
        )}
        {hostTyping && (
          <span
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 text-text-secondary"
            data-testid="host-typing-indicator"
            role="status"
            aria-label="Host is typing"
          >
            <span className="flex gap-0.5" aria-hidden="true">
              <span className="w-1 h-1 bg-current rounded-full animate-bounce" />
              <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            Host typing…
          </span>
        )}
      </div>
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
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto space-y-2 pr-1"
          data-testid="guest-messages-list"
          onScroll={handleThreadScroll}
        >
          {messages.map((m) => {
            const isGuest = m.sender === "Guest";
            const receipt = receiptState(m.status);
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
                    {isGuest && (
                      <span
                        data-testid="guest-message-ticks"
                        data-state={receipt}
                        role="img"
                        aria-label={`Message ${receipt}`}
                        className={`ml-1 ${receiptClassName(receipt)}`}
                      >
                        {receiptGlyph(receipt)}
                      </span>
                    )}
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

      <div className="space-y-3" data-testid="guest-message-composer">
      <div className="space-y-1">
        <label htmlFor="guest-message-category" className="block text-sm font-medium">Message category</label>
        <select id="guest-message-category" value={category} disabled={sending}
          onChange={(event) => setCategory(parseStayIssueCategory(event.target.value))}
          className="min-h-11 w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm">
          <option value="">General message</option>
          {STAY_ISSUE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {category && <p className="text-xs text-text-secondary">Your message will start with {prefix.trim()}. It is sent when you choose Send.</p>}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onFocus={() => {
            isComposingRef.current = true;
          }}
          onBlur={() => {
            isComposingRef.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!e.repeat) void handleSend();
            }
          }}
          placeholder="Type a message to your host…"
          aria-label="Message to your host"
          aria-describedby="guest-message-length"
          disabled={sending}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH - prefix.length}
          className="min-w-0 flex-1 rounded-lg border border-border-subtle px-3 py-2 text-sm resize-none"
          data-testid="guest-message-input"
        />
        <button
          type="button"
          disabled={sending || !draft.trim() || messageTooLong}
          onClick={() => void handleSend()}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-2 hover:bg-brand-primary/90 transition-colors disabled:opacity-50 sm:self-end"
          data-testid="guest-message-send"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
      <p id="guest-message-length" className={`text-xs ${messageTooLong ? 'text-red-600' : 'text-text-muted'}`} role={messageTooLong ? 'alert' : undefined}>
        {messageTooLong ? 'Shorten your message to send. ' : ''}{prefix.length + draft.length}/{MAX_MESSAGE_LENGTH} characters including category. Shift+Enter adds a new line.
      </p>
      </div>
    </div>
  );
}
