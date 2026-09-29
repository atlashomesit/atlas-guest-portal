import { useEffect, useRef, useState, type FormEvent } from 'react';
import { buildApiUrl, getApiHeaders } from '../api/client';

interface Props {
  initialEmail: string;
  listingIds: number[];
  tenantSlug?: string;
}

/** The parent remounts this form when the guest or tenant changes. */
export default function SavedHomesReminder({ initialEmail, listingIds, tenantSlug }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error' | 'invalid'>('idle');
  const [partialCount, setPartialCount] = useState(0);
  const active = useRef(true);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (request.current) return;
    const recipient = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      setState('invalid');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setState('busy');
    setPartialCount(0);
    try {
      const results = await Promise.allSettled(listingIds.map((listingId) => fetch(buildApiUrl('/api/saved-listings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getApiHeaders(tenantSlug) },
        body: JSON.stringify({ guestEmail: recipient, listingId }),
        signal: controller.signal,
      })));
      if (!active.current || controller.signal.aborted) return;
      const successful = results.filter((result) => result.status === 'fulfilled' && result.value.ok).length;
      setPartialCount(successful);
      setState(successful > 0 && successful === listingIds.length ? 'done' : 'error');
    } catch {
      if (active.current && !controller.signal.aborted) setState('error');
    } finally {
      if (request.current === controller) request.current = null;
    }
  };

  if (state === 'done') {
    return <p role="status" className="text-sm text-green-700 font-medium">✓ We'll remind you in 7 days if you haven't booked.</p>;
  }

  return (
    <section aria-labelledby="saved-home-reminder-title" className="rounded-2xl border border-brand-primary/30 bg-brand-primary/5 p-4">
      <h2 id="saved-home-reminder-title" className="text-sm font-medium text-text-primary mb-1">Get reminded about these homes</h2>
      <p id="reminder-email-description" className="text-xs text-text-secondary mb-3">
        We'll send a one-time reminder in 7 days if you haven't booked yet. You can use a different email.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="saved-home-reminder-email" className="sr-only">Reminder email address</label>
        <input
          id="saved-home-reminder-email"
          type="email"
          autoComplete="email"
          required
          placeholder="your@email.com"
          aria-describedby="reminder-email-description"
          aria-invalid={state === 'invalid'}
          value={email}
          disabled={state === 'busy'}
          onChange={(event) => { setEmail(event.target.value); setState('idle'); }}
          className="flex-1 min-w-0 rounded-lg border border-border-subtle px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
        <button type="submit" disabled={state === 'busy'} className="rounded-lg bg-brand-primary px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50 min-h-11">
          {state === 'busy' ? 'Saving…' : 'Remind me'}
        </button>
      </form>
      {state === 'error' && (
        <p className="text-xs text-red-600 mt-2" role="alert">
          {partialCount > 0 ? `Reminder set for ${partialCount} of ${listingIds.length} homes. ` : ''}
          We couldn't save your reminder for every saved home. Please try again in a moment.
        </p>
      )}
      {state === 'invalid' && <p className="text-xs text-red-600 mt-2" role="alert">Please enter a valid email address.</p>}
    </section>
  );
}
