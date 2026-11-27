import React, { useState } from 'react';
import { Receipt, Download, CheckCircle2 } from 'lucide-react';
import { buildApiUrl, getApiHeaders } from '@/api/client';
import { normalizeGstin, validateCompanyGstInput } from '@/utils/gstin';

export interface BookingGstDetailsCardProps {
  bookingId: number | string;
  token?: string | null;
  initialCompanyName?: string | null;
  initialGuestGstin?: string | null;
  gstLocked?: boolean;
  invoicePdfUrl?: string | null;
  onUpdated?: (next: { companyName: string; guestGstin: string }) => void;
}

/**
 * GUEST-084: Self-service B2B GSTIN & Company Name editor on /booking/:bookingId.
 */
export const BookingGstDetailsCard: React.FC<BookingGstDetailsCardProps> = ({
  bookingId,
  token,
  initialCompanyName,
  initialGuestGstin,
  gstLocked = false,
  invoicePdfUrl,
  onUpdated,
}) => {
  const [editing, setEditing] = useState(!initialGuestGstin && !initialCompanyName);
  const [companyName, setCompanyName] = useState(initialCompanyName ?? '');
  const [guestGstin, setGuestGstin] = useState(initialGuestGstin ? normalizeGstin(initialGuestGstin) : '');
  const [companyNameError, setCompanyNameError] = useState<string | undefined>();
  const [gstinError, setGstinError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const effectivePdfUrl =
    invoicePdfUrl ||
    buildApiUrl(
      `/api/public/bookings/${bookingId}/invoice/pdf${token ? `?t=${encodeURIComponent(token)}` : ''}`,
    );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSavedMessage(null);

    const normalized = normalizeGstin(guestGstin);
    const trimmedName = companyName.trim();
    const errs = validateCompanyGstInput({ companyName: trimmedName, guestGstin: normalized });
    setCompanyNameError(errs.companyNameError);
    setGstinError(errs.gstinError);
    if (errs.companyNameError || errs.gstinError) return;

    setSubmitting(true);
    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : '';
      const res = await fetch(buildApiUrl(`/api/public/bookings/${bookingId}/gst-details${qs}`), {
        method: 'PATCH',
        headers: {
          ...getApiHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: trimmedName,
          guestGstin: normalized,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || errBody?.error || 'Could not update GST invoice details.');
      }
      setCompanyName(trimmedName);
      setGuestGstin(normalized);
      setEditing(false);
      setSavedMessage('GST details saved. Your B2B tax invoice PDF is ready.');
      onUpdated?.({ companyName: trimmedName, guestGstin: normalized });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not update GST invoice details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3"
      data-testid="booking-gst-details-card"
      aria-label="Company GST invoice details"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-text-primary">B2B GST Tax Invoice</h2>
        </div>
        {!editing && !gstLocked && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setSavedMessage(null);
            }}
            className="text-xs font-medium text-accent-primary hover:underline"
            data-testid="booking-gst-edit-btn"
          >
            Edit GSTIN
          </button>
        )}
      </div>

      {gstLocked ? (
        <p className="text-xs text-text-secondary">
          GST details are locked for GSTR-1 filing.
          {companyName && guestGstin ? ` (${companyName} · ${guestGstin})` : ''}
        </p>
      ) : editing ? (
        <form onSubmit={handleSave} className="space-y-3" data-testid="booking-gst-form">
          <div>
            <label htmlFor="booking-company-name" className="block text-xs font-medium text-text-secondary mb-1">
              Company name
            </label>
            <input
              id="booking-company-name"
              type="text"
              maxLength={120}
              placeholder="e.g. Acme Technologies Pvt Ltd"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (companyNameError) setCompanyNameError(undefined);
              }}
              className="w-full rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm text-text-primary"
              data-testid="booking-company-name-input"
            />
            {companyNameError && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {companyNameError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="booking-company-gstin" className="block text-xs font-medium text-text-secondary mb-1">
              Company GSTIN
            </label>
            <input
              id="booking-company-gstin"
              type="text"
              maxLength={15}
              placeholder="29ABCDE1234F1Z5"
              value={guestGstin}
              onChange={(e) => {
                setGuestGstin(normalizeGstin(e.target.value));
                if (gstinError) setGstinError(undefined);
              }}
              className="w-full rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm font-mono uppercase text-text-primary"
              data-testid="booking-gstin-input"
            />
            {gstinError && (
              <p className="mt-1 text-xs text-red-600" role="alert" data-testid="booking-gstin-error">
                {gstinError}
              </p>
            )}
          </div>

          {serverError && (
            <p className="text-xs text-red-600" role="alert" data-testid="booking-gst-server-error">
              {serverError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-lg bg-accent-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              data-testid="booking-gst-save-btn"
            >
              {submitting ? 'Saving…' : 'Save GST details'}
            </button>
            {(initialCompanyName || initialGuestGstin) && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs text-text-secondary hover:underline px-2 py-2"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-2 text-xs text-text-secondary">
          {savedMessage && (
            <div className="flex items-center gap-1.5 text-emerald-700 font-medium" data-testid="booking-gst-saved-msg">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{savedMessage}</span>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-text-primary">{companyName}</span>
            <span className="font-mono tracking-wide">GSTIN: {guestGstin}</span>
          </div>
          <a
            href={effectivePdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-muted"
            data-testid="booking-gst-download-pdf"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Download GST Invoice PDF
          </a>
        </div>
      )}
    </section>
  );
};
