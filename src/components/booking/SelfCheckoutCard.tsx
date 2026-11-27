import React, { useMemo, useState } from 'react';
import { LogOut, CheckCircle2, Star } from 'lucide-react';
import { buildApiUrl, getApiHeaders } from '@/api/client';

const DEFAULT_CHECKOUT_ITEMS = [
  'Keys returned or left as instructed',
  'Lights, AC, and appliances switched off',
  'Windows and doors locked',
];

/**
 * Returns YYYY-MM-DD in Asia/Kolkata (IST) for the given Date.
 */
export function getIstDateIso(now: Date = new Date()): string {
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

/**
 * True when today in IST matches the booking's checkout date (YYYY-MM-DD).
 */
export function isDepartureDayIst(checkoutDateIso?: string | null, now: Date = new Date()): boolean {
  if (!checkoutDateIso) return false;
  const normalized = checkoutDateIso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  return normalized === getIstDateIso(now);
}

export function parseCheckoutChecklist(raw?: string | null): string[] {
  if (!raw?.trim()) return DEFAULT_CHECKOUT_ITEMS;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-•*·\d.)]+/, '').trim())
    .filter(Boolean);
  return lines.length > 0 ? lines.slice(0, 8) : DEFAULT_CHECKOUT_ITEMS;
}

export interface SelfCheckoutCardProps {
  bookingId: number | string;
  token?: string | null;
  status: string;
  checkoutDateIso?: string | null;
  guidebookCheckoutChecklistText?: string | null;
  guestReportedCheckoutAtUtc?: string | null;
  now?: Date;
}

/**
 * GUEST-087: Departure-day "I have checked out" self-checkout card with checklist & quick 1-5 star rating.
 */
export const SelfCheckoutCard: React.FC<SelfCheckoutCardProps> = ({
  bookingId,
  token,
  status,
  checkoutDateIso,
  guidebookCheckoutChecklistText,
  guestReportedCheckoutAtUtc,
  now,
}) => {
  const items = useMemo(
    () => parseCheckoutChecklist(guidebookCheckoutChecklistText),
    [guidebookCheckoutChecklistText],
  );
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [rating, setRating] = useState<number>(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedOutAt, setCheckedOutAt] = useState<string | null>(guestReportedCheckoutAtUtc ?? null);

  const normalizedStatus = (status || '').toLowerCase();
  const eligibleStatus = normalizedStatus === 'confirmed' || normalizedStatus === 'checkedin' || normalizedStatus === 'checked_in';
  const showCard = Boolean(checkedOutAt) || (eligibleStatus && isDepartureDayIst(checkoutDateIso, now));

  if (!showCard) return null;

  const toggleItem = (idx: number) => {
    setChecked((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleConfirmCheckout = async () => {
    if (submitting || checkedOutAt) return;
    setError(null);
    setSubmitting(true);
    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : '';
      const checkedItems = items.filter((_, i) => Boolean(checked[i]));
      const res = await fetch(buildApiUrl(`/api/public/bookings/${bookingId}/guest-checkout${qs}`), {
        method: 'POST',
        headers: {
          ...getApiHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkedItems,
          rating: rating > 0 ? rating : undefined,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || errBody?.error || 'Could not record checkout. Please try again.');
      }
      const data = await res.json().catch(() => null);
      setCheckedOutAt(data?.guestReportedCheckoutAtUtc || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4"
      data-testid="self-checkout-card"
      aria-label="Self checkout"
    >
      <div className="flex items-center gap-2">
        <LogOut className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-text-primary">Heading out today?</h2>
      </div>

      {checkedOutAt ? (
        <div
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"
          data-testid="self-checkout-confirmed"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">You&apos;ve checked out — safe travels!</p>
            <p className="text-emerald-800 mt-0.5">
              We&apos;ve notified your host and housekeeping team so they can prepare the space.
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-text-secondary">
            Let your host know in one tap when you&apos;ve vacated the property.
          </p>

          <div className="space-y-2" data-testid="self-checkout-checklist">
            {items.map((item, idx) => (
              <label key={`${idx}-${item}`} className="flex items-start gap-2.5 text-xs text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(checked[idx])}
                  onChange={() => toggleItem(idx)}
                  className="mt-0.5 h-4 w-4 rounded border-border-strong accent-emerald-600"
                  data-testid={`self-checkout-item-${idx}`}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>

          <div className="pt-2 border-t border-emerald-200/70 space-y-2">
            <div className="text-xs font-medium text-text-secondary">How was your stay? (optional)</div>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Stay rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`${star} star${star === 1 ? '' : 's'}`}
                  aria-pressed={rating === star}
                  className="p-1 rounded hover:bg-emerald-100/70"
                  data-testid={`self-checkout-star-${star}`}
                >
                  <Star
                    className={`w-5 h-5 ${star <= rating ? 'fill-amber-400 text-amber-500' : 'text-text-muted'}`}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              maxLength={300}
              placeholder="Quick note for your host (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-xs text-text-primary"
              data-testid="self-checkout-note"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600" role="alert" data-testid="self-checkout-error">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirmCheckout}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            data-testid="self-checkout-confirm-btn"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            {submitting ? 'Confirming checkout…' : 'I have checked out'}
          </button>
        </>
      )}
    </section>
  );
};
