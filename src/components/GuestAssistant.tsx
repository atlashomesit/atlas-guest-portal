/**
 * TASK-1728: Guest Assistant FAQ widget v2 (closes TASK-1465)
 * Floating button bottom-left of listing detail page.
 * Renders listing-specific FAQ from GET /listings/{id}/faq with keyword search.
 * Falls back to AI chat (POST /api/public/chat) when no FAQ matches are found.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { buildApiUrl, getApiHeaders } from '../api/client';
import { messageFromApiResponse } from '../utils/serverErrorFromResponse';

interface FaqEntry {
  q: string;
  a: string;
}

interface GuestAssistantProps {
  /** Numeric listing ID — widget is suppressed when null/NaN. */
  listingId: string | number | null;
}

/**
 * GuestAssistant — FAQ panel for listing-specific questions.
 * Positioned bottom-left to avoid conflict with SupportWidget (bottom-right).
 */
export default function GuestAssistant({ listingId }: GuestAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [faqs, setFaqs] = useState<FaqEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchErrorMessage, setFetchErrorMessage] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch FAQ entries when listing ID is known
  useEffect(() => {
    if (!listingId || isNaN(Number(listingId))) return;
    setLoading(true);
    setFetchErrorMessage(null);
    const url = buildApiUrl(`/api/public/listings/${Number(listingId)}/faq`);
    fetch(url, { headers: getApiHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error(await messageFromApiResponse(r));
        return r.json() as Promise<unknown>;
      })
      .then((data: unknown) => setFaqs(Array.isArray(data) ? (data as FaqEntry[]) : []))
      .catch((err: unknown) => {
        setFetchErrorMessage(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't load FAQs. Please try again later.",
        );
        setFaqs([]);
      })
      .finally(() => setLoading(false));
  }, [listingId]);

  // Reset UI state when panel opens/closes
  useEffect(() => {
    if (isOpen) {
      // Defer focus so the CSS transition doesn't fight with focus
      const t = window.setTimeout(() => inputRef.current?.focus(), 150);
      return () => window.clearTimeout(t);
    } else {
      setQuery('');
      setExpandedIdx(null);
      setAiReply(null);
    }
    return undefined;
  }, [isOpen]);

  const handleAskAi = useCallback(async () => {
    if (!query.trim()) return;
    setAiLoading(true);
    setAiReply(null);
    try {
      const url = buildApiUrl('/api/public/chat');
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query.trim(), listingId: Number(listingId) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { reply?: string };
      setAiReply(data.reply ?? 'No answer available. Please contact the host directly.');
    } catch {
      setAiReply('Unable to get an AI answer right now. Please contact the host directly.');
    } finally {
      setAiLoading(false);
    }
  }, [query, listingId]);

  const handleToggle = useCallback((idx: number) => {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  }, []);

  const filtered = useMemo(() => {
    setAiReply(null);
    const q = query.toLowerCase().trim();
    if (!q) return faqs;
    return faqs.filter(
      (e) => e.q.toLowerCase().includes(q) || e.a.toLowerCase().includes(q),
    );
  }, [faqs, query]);

  // Don't render if no valid listing
  if (!listingId || isNaN(Number(listingId))) return null;

  // Don't render trigger if no FAQs and not loading (avoids empty panel)
  if (!loading && !fetchErrorMessage && faqs.length === 0) return null;

  return (
    <>
      {/* Floating trigger — bottom-left to avoid collision with SupportWidget (bottom-right) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="View frequently asked questions"
          className={[
            'fixed left-4 z-[var(--z-floating)]',
            // On mobile clear the reserve bar (~56 px); on md+ use standard 20 px gap
            'bottom-[4.5rem] md:bottom-5',
            'inline-flex items-center gap-2 rounded-full',
            'border bg-transparent px-3.5 py-2.5',
            'text-sm font-semibold text-text-primary',
            'shadow-level3 ring-1 ring-border-subtle',
            'transition hover:-translate-y-0.5 hover:shadow-level4',
            'focus-visible:outline
          ].join(' ')}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-accent-primary">
            <HelpCircle size={16} aria-hidden="true" />
          </span>
          <span className="hidden sm:block">FAQs</span>
        </button>
      )}

      {/* FAQ Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            role="presentation"
            className="fixed inset-0 bg-black/30 z-[calc(var(--z-floating)+1)]"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel — full-width sheet on mobile, card on md+ */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Listing FAQ"
            className={[
              'fixed bottom-0 left-0 right-0 z-[calc(var(--z-floating)+2)]',
              'flex flex-col bg-transparent',
              'rounded-t-2xl shadow-level4',
              'max-h-[75vh]',
              'md:left-auto md:right-4 md:bottom-4 md:w-96',
              'md:rounded-2xl md:max-h-[60vh]',
            ].join(' ')}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-text-primary leading-tight">
                  Questions &amp; Answers
                </h2>
                {!loading && (
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {faqs.length === 0
                      ? 'No FAQs available'
                      : `${faqs.length} FAQ${faqs.length !== 1 ? 's' : ''} for this listing`}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="flex-shrink-0 rounded-full p-1.5 text-text-muted hover:bg-bg-subtle
                onClick={() => setIsOpen(false)}
                aria-label="Close FAQ panel"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Search bar */}
            {faqs.length > 0 && (
              <div className="px-4 py-2.5 border-b">
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search questions…"
                  aria-label="Search FAQs"
                  className={[
                    'w-full rounded-lg',
                    'bg-bg-subtle px-3 py-2 text-sm text-text-primary',
                    'placeholder:text-text-muted',
                    'focus:outline-none focus:ring-2 focus:ring-cta-primary',
                  ].join(' ')}
                />
              </div>
            )}

            {/* FAQ list */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {loading && (
                <div className="flex items-center justify-center py-10">
                  <div
                    aria-label="Loading FAQs"
                    role="status"
                    className="h-6 w-6 rounded-full border-2 border-t-cta-primary animate-spin"
                  />
                </div>
              )}

              {fetchErrorMessage && !loading && (
                <p className="py-8 text-center text-sm text-text-muted">{fetchErrorMessage}</p>
              )}

              {!loading && !fetchErrorMessage && filtered.length === 0 && (
                <div className="py-6 px-1 text-center">
                  <p className="text-sm text-text-muted mb-3">
                    {query.trim() ? 'No matching FAQ found.' : 'No FAQs for this listing yet.'}
                  </p>
                  {query.trim() && (
                    <>
                      {!aiReply && !aiLoading && (
                        <button
                          type="button"
                          onClick={() => void handleAskAi()}
                          className="rounded-lg bg-cta-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition"
                        >
                          Ask AI →
                        </button>
                      )}
                      {aiLoading && (
                        <p className="text-xs text-text-muted animate-pulse">Getting AI answer…</p>
                      )}
                      {aiReply && (
                        <div className="mt-2 rounded-xl bg-bg-subtle p-3 text-left text-sm text-text-secondary">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1">AI answer</p>
                          {aiReply}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {!loading &&
                !fetchErrorMessage &&
                filtered.map((entry, i) => (
                  <div
                    key={i}
                    className="rounded-xl overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggle(i)}
                      aria-expanded={expandedIdx === i}
                      className="flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left text-sm font-medium text-text-primary hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cta-primary"
                    >
                      <span className="flex-1 leading-snug">{entry.q}</span>
                      {expandedIdx === i ? (
                        <ChevronUp
                          size={14}
                          className="mt-0.5 flex-shrink-0 text-text-muted"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronDown
                          size={14}
                          className="mt-0.5 flex-shrink-0 text-text-muted"
                          aria-hidden="true"
                        />
                      )}
                    </button>

                    {expandedIdx === i && (
                      <div className="px-3.5 pb-3 pt-2.5 text-sm text-text-secondary leading-relaxed border-t bg-bg-subtle">
                        {entry.a}
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t bg-bg-subtle rounded-b-2xl md:rounded-b-2xl">
              <p className="text-[10px] text-text-muted text-center">
                Keyword search · AI answers available
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
