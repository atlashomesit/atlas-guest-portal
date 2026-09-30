import { useEffect, useRef, useState } from 'react';
import { Mic, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { buildApiUrl, getApiHeaders } from '@/api/client';
import { SUPPORT_DRAWER_COPY } from '@/config/supportDrawerCopy';

type ChatReply = { reply?: unknown; source?: unknown };
type ChatMessage = { question: string; reply: string; source: 'faq' | 'ai' | 'fallback' };

const sourceLabel = (source: ChatMessage['source']) => {
  if (source === 'faq') return SUPPORT_DRAWER_COPY.assistant.faqSource;
  if (source === 'ai') return SUPPORT_DRAWER_COPY.assistant.aiSource;
  return SUPPORT_DRAWER_COPY.assistant.fallbackSource;
};

const AtlasChat = ({ listingId, onBack }: { listingId?: string | null; onBack: () => void }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const inFlight = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const speechRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    const recognition = speechRef.current;
    speechRef.current = null;
    recognition?.stop();
  }, []);
  useEffect(() => {
    if (!sending) inputRef.current?.focus();
  }, [sending]);
  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages]);

  const send = async (spoken?: string) => {
    const question = (spoken ?? input).trim();
    if (!question || inFlight.current) return;
    if (question.length > 2000) {
      setError(SUPPORT_DRAWER_COPY.assistant.tooLong);
      return;
    }
    inFlight.current = true;
    const recognition = speechRef.current;
    speechRef.current = null;
    recognition?.stop();
    setListening(false);
    const controller = new AbortController();
    requestRef.current = controller;
    setSending(true);
    setError(null);
    try {
      const parsedId = listingId && /^\d+$/.test(listingId) ? Number(listingId) : null;
      const numericId = parsedId !== null && Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
      const response = await fetch(buildApiUrl('/api/public/chat'), {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
        body: JSON.stringify({ listingId: numericId, message: question }),
      });
      if (!response.ok) throw new Error('request failed');
      const data = await response.json() as ChatReply;
      if (controller.signal.aborted) return;
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('empty reply');
      const source = data.source === 'faq' || data.source === 'ai' ? data.source : 'fallback';
      setMessages((previous) => [...previous, { question, reply: data.reply as string, source }]);
      setInput((current) => current.trim() === question ? '' : current);
    } catch {
      if (controller.signal.aborted) return;
      setError(SUPPORT_DRAWER_COPY.assistant.error);
      setInput((current) => current || question);
    } finally {
      inFlight.current = false;
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setSending(false);
    }
  };

  const startSpeechToText = () => {
    if (inFlight.current) return;
    if (speechRef.current) {
      const recognition = speechRef.current;
      speechRef.current = null;
      recognition.stop();
      setListening(false);
      return;
    }
    const recognitionConstructor = (window as Window & { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
    if (!recognitionConstructor) {
      setError(SUPPORT_DRAWER_COPY.assistant.voiceUnavailable);
      return;
    }
    const recognition = new recognitionConstructor();
    speechRef.current = recognition;
    recognition.lang = 'en-IN';
    recognition.onstart = () => {
      if (speechRef.current === recognition) setListening(true);
    };
    recognition.onend = () => {
      if (speechRef.current !== recognition) return;
      speechRef.current = null;
      setListening(false);
    };
    recognition.onerror = () => {
      if (speechRef.current !== recognition) return;
      speechRef.current = null;
      setListening(false);
      setError(SUPPORT_DRAWER_COPY.assistant.voiceUnavailable);
    };
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (inFlight.current || speechRef.current !== recognition) return;
      const transcript = event.results[0]?.[0]?.transcript?.slice(0, 2000) ?? '';
      setInput(transcript);
    };
    try {
      recognition.start();
    } catch {
      speechRef.current = null;
      setListening(false);
      setError(SUPPORT_DRAWER_COPY.assistant.voiceUnavailable);
    }
  };

  return (
    <section className="flex min-h-0 flex-col gap-3 px-4 pb-4" aria-label={SUPPORT_DRAWER_COPY.assistant.entryLabel}>
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle py-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{SUPPORT_DRAWER_COPY.assistant.entryLabel}</h2>
          <p className="text-xs text-text-muted">{SUPPORT_DRAWER_COPY.assistant.disclosure}</p>
        </div>
        <button type="button" onClick={onBack} className="min-h-11 shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-cta-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-cta-primary">
          {SUPPORT_DRAWER_COPY.assistant.backLabel}
        </button>
      </div>
      <div ref={transcriptRef} role="log" aria-label="Stay assistant answers" className="max-h-[min(40vh,320px)] space-y-3 overflow-y-auto" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className="rounded-xl border border-border-subtle bg-bg-muted p-3 text-sm">
            <p className="mb-2 font-medium text-text-primary">{message.question}</p>
            <p className="mb-1 text-[11px] font-semibold text-text-muted">{sourceLabel(message.source)}</p>
            <div className="break-words text-text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown allowedElements={['p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'code', 'br']} unwrapDisallowed components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>{message.reply}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-[var(--support-error)]">{error}</p>}
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <input
          ref={inputRef}
          aria-label="Ask the Stay assistant"
          value={input}
          disabled={sending}
          maxLength={2000}
          onChange={(event) => setInput(event.target.value)}
          placeholder={SUPPORT_DRAWER_COPY.assistant.inputPlaceholder}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-primary"
        />
        <button type="button" onClick={startSpeechToText} disabled={sending} aria-label="Start voice input" aria-pressed={listening} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-muted disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cta-primary">
          <Mic size={18} aria-hidden="true" />
        </button>
        <button type="submit" aria-label="Send message" disabled={!input.trim() || sending} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-cta-primary text-[var(--text-on-cta)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cta-primary">
          <Send size={18} aria-hidden="true" />
        </button>
      </form>
      {listening && <p role="status" className="text-xs text-text-muted">Listening… select the microphone to stop.</p>}
      {sending && <p role="status" className="text-xs text-text-muted">Getting an answer…</p>}
      <p className="text-[11px] text-text-muted">{SUPPORT_DRAWER_COPY.assistant.humanHelp}</p>
    </section>
  );
};

export default AtlasChat;
