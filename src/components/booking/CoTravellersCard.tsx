import React, { useState } from 'react';
import { Users, Copy, Check, Trash2, Share2, UserPlus } from 'lucide-react';
import { buildApiUrl, getApiHeaders } from '@/api/client';

export interface BookingCoTraveller {
  id: number | string;
  name: string;
  phone?: string | null;
  email?: string | null;
  accessToken?: string | null;
  shareUrl?: string | null;
}

export interface CoTravellersCardProps {
  bookingId: number | string;
  token?: string | null;
  propertyName?: string;
  maxCoTravellers?: number;
  initialCoTravellers?: BookingCoTraveller[] | null;
}

/**
 * GUEST-086: Add and remove co-travellers on /booking/:bookingId with shareable arrival-hub link.
 */
export const CoTravellersCard: React.FC<CoTravellersCardProps> = ({
  bookingId,
  token,
  propertyName,
  maxCoTravellers = 4,
  initialCoTravellers,
}) => {
  const cap = Math.max(1, maxCoTravellers);
  const [coTravellers, setCoTravellers] = useState<BookingCoTraveller[]>(
    Array.isArray(initialCoTravellers) ? initialCoTravellers : [],
  );
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<number | string | null>(null);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildShareUrl = (ct: BookingCoTraveller): string => {
    if (ct.shareUrl) return ct.shareUrl;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const ctParam = ct.accessToken ? `?ct=${encodeURIComponent(ct.accessToken)}` : '';
    return `${origin}/booking/${bookingId}${ctParam}`;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    const trimmedContact = contact.trim();
    if (!trimmedName) {
      setError('Enter your co-traveller’s name.');
      return;
    }
    if (coTravellers.length >= cap) {
      setError(`You can add up to ${cap} co-traveller${cap === 1 ? '' : 's'} for this stay.`);
      return;
    }

    const isEmail = trimmedContact.includes('@');
    setSubmitting(true);
    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : '';
      const res = await fetch(buildApiUrl(`/api/public/bookings/${bookingId}/co-travellers${qs}`), {
        method: 'POST',
        headers: {
          ...getApiHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          phone: !isEmail && trimmedContact ? trimmedContact : undefined,
          email: isEmail ? trimmedContact : undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || errBody?.error || 'Could not add co-traveller.');
      }
      const created = await res.json().catch(() => null);
      const added: BookingCoTraveller = {
        id: created?.id ?? `local-${Date.now()}`,
        name: created?.name ?? trimmedName,
        phone: created?.phone ?? (!isEmail && trimmedContact ? trimmedContact : null),
        email: created?.email ?? (isEmail ? trimmedContact : null),
        accessToken: created?.accessToken ?? null,
        shareUrl: created?.shareUrl ?? null,
      };
      setCoTravellers((prev) => [...prev, added]);
      setName('');
      setContact('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add co-traveller.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (ct: BookingCoTraveller) => {
    setError(null);
    setRemovingId(ct.id);
    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : '';
      const res = await fetch(
        buildApiUrl(`/api/public/bookings/${bookingId}/co-travellers/${ct.id}${qs}`),
        {
          method: 'DELETE',
          headers: getApiHeaders(),
        },
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || errBody?.error || 'Could not remove co-traveller.');
      }
      setCoTravellers((prev) => prev.filter((item) => item.id !== ct.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove co-traveller.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleCopy = async (ct: BookingCoTraveller) => {
    const url = buildShareUrl(ct);
    try {
      await navigator.clipboard?.writeText(url);
      setCopiedId(ct.id);
      setTimeout(() => setCopiedId((cur) => (cur === ct.id ? null : cur)), 2000);
    } catch {
      // ignore clipboard errors in restricted contexts
    }
  };

  return (
    <section
      className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-4"
      data-testid="co-travellers-card"
      aria-label="Co-travellers"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-text-primary">Who&apos;s travelling with you?</h2>
        </div>
        <span className="text-xs text-text-muted">
          {coTravellers.length}/{cap}
        </span>
      </div>

      <p className="text-xs text-text-secondary">
        Share a private arrival-hub link (directions, Wi-Fi, guidebook &amp; check-in) without showing payment details or invoices.
      </p>

      {coTravellers.length > 0 && (
        <ul className="space-y-2" data-testid="co-travellers-list">
          {coTravellers.map((ct) => {
            const shareUrl = buildShareUrl(ct);
            const waText = encodeURIComponent(
              `Here is our arrival hub for ${propertyName || 'our stay'}: ${shareUrl}`,
            );
            return (
              <li
                key={ct.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border-subtle bg-bg-muted/50 px-3 py-2.5"
                data-testid={`co-traveller-row-${ct.id}`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{ct.name}</div>
                  {(ct.phone || ct.email) && (
                    <div className="text-xs text-text-secondary truncate">{ct.phone || ct.email}</div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopy(ct)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-strong bg-bg-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-bg-muted"
                    data-testid={`co-traveller-copy-${ct.id}`}
                  >
                    {copiedId === ct.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        Copy link
                      </>
                    )}
                  </button>

                  <a
                    href={`https://wa.me/?text=${waText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                    data-testid={`co-traveller-wa-${ct.id}`}
                  >
                    <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                    WhatsApp
                  </a>

                  <button
                    type="button"
                    disabled={removingId === ct.id}
                    onClick={() => handleRemove(ct)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    data-testid={`co-traveller-remove-${ct.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {coTravellers.length < cap && (
        <form onSubmit={handleAdd} className="space-y-2.5 pt-2 border-t border-border-subtle" data-testid="co-traveller-add-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              maxLength={100}
              placeholder="Co-traveller name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm text-text-primary"
              data-testid="co-traveller-name-input"
            />
            <input
              type="text"
              maxLength={160}
              placeholder="Phone or email (optional)"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm text-text-primary"
              data-testid="co-traveller-contact-input"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600" role="alert" data-testid="co-traveller-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-primary px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
            data-testid="co-traveller-add-btn"
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
            {submitting ? 'Adding…' : 'Add co-traveller'}
          </button>
        </form>
      )}
    </section>
  );
};
